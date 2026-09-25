import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { MediaType } from "@/domain/media";
import type { NextUpItem, SnoozeMap } from "@/lib/next-up-engine";
import { useSeasonDetails } from "@/hooks/use-season-details";
import { useContinueWatching } from "@/hooks/watch-progress/use-watch-progress";
import { detectRegion } from "@/lib/detect-region";
import {
  buildNextUpQueue,
  snoozeItem,
  unsnoozeItem,
} from "@/lib/next-up-engine";
import { getWatchProviders } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import { parseEpisodeKey } from "@/lib/watch-progress";
import { useLocalProgressStore } from "@/stores/local-progress-store";

const SNOOZE_STORAGE_KEY = "pebbly:next_up_snooze";

export type NextUpEpisodeDetail = {
  name: string;
  stillPath: string | null;
  overview: string | null;
  runtime: number | null;
  airDate: string | null;
  seasonNumber: number;
  episodeNumber: number;
};

export type NextUpWatchProvider = {
  id: number;
  name: string;
  logoPath: string | null;
};

function readSnoozeMap(): SnoozeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSnoozeMap(map: SnoozeMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage quota or private mode error
  }
}

export function useNextUp() {
  const {
    items: continueWatching,
    isLoading,
    isSettled,
  } = useContinueWatching();
  const repository = useRepository();
  const [snoozeMap, setSnoozeMap] = useState<SnoozeMap>(readSnoozeMap);

  const localLastPlayed = useLocalProgressStore((s) => s.lastPlayed);
  const localWatchedEpisodes = useLocalProgressStore((s) => s.watchedEpisodes);

  // Synchronize snooze changes from other tabs or windows
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SNOOZE_STORAGE_KEY && e.newValue) {
        try {
          setSnoozeMap(JSON.parse(e.newValue));
        } catch {
          // Ignore parse errors
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const watchedEpisodesByTvId = useMemo(() => {
    const map: Record<string, Array<{ season: number; episode: number }>> = {};
    for (const [key, isWatched] of Object.entries(localWatchedEpisodes)) {
      if (isWatched) {
        const parsed = parseEpisodeKey(key);
        if (parsed) {
          const id = String(parsed.tmdbId);
          if (!map[id]) map[id] = [];
          map[id].push({ season: parsed.season, episode: parsed.episode });
        }
      }
    }
    return map;
  }, [localWatchedEpisodes]);

  const queue: NextUpItem[] = useMemo(() => {
    return buildNextUpQueue({
      continueWatching,
      snoozeMap,
      lastPlayedByTvId: localLastPlayed,
      watchedEpisodesByTvId,
      now: Date.now(),
    });
  }, [continueWatching, snoozeMap, localLastPlayed, watchedEpisodesByTvId]);

  const topItem = queue[0] ?? null;

  // Resolve episode metadata for the top TV show
  const topSeasonNumber =
    topItem?.type === "tv" && topItem?.nextEpisode
      ? topItem.nextEpisode.season
      : undefined;
  const topEpisodeNumber =
    topItem?.type === "tv" && topItem?.nextEpisode
      ? topItem.nextEpisode.episode
      : undefined;

  const seasonDetailsQuery = useSeasonDetails(
    topItem ? Number(topItem.id) : 0,
    topSeasonNumber,
  );

  const topEpisodeDetails: NextUpEpisodeDetail | null = useMemo(() => {
    if (!topItem || topItem.type !== "tv" || !topEpisodeNumber) return null;
    const seasonData = seasonDetailsQuery.data;
    if (!seasonData?.episodes) return null;
    const ep = seasonData.episodes.find(
      (e) => e.episode_number === topEpisodeNumber,
    );
    if (!ep) return null;
    return {
      name: ep.name,
      stillPath: ep.still_path,
      overview: ep.overview,
      runtime: ep.runtime,
      airDate: ep.air_date,
      seasonNumber: topSeasonNumber ?? 1,
      episodeNumber: topEpisodeNumber,
    };
  }, [topItem, topSeasonNumber, topEpisodeNumber, seasonDetailsQuery.data]);

  // Resolve watch providers for the top item
  const region = useMemo(() => detectRegion(), []);
  const watchProvidersQuery = useQuery({
    queryKey:
      topItem && Number(topItem.id) > 0
        ? queryKeys.tmdb.watchProviders(Number(topItem.id), topItem.type)
        : ["noop-providers"],
    queryFn: () => {
      if (!topItem) return Promise.resolve(null);
      return getWatchProviders({ type: topItem.type, id: Number(topItem.id) });
    },
    enabled: !!topItem && Number(topItem.id) > 0,
  });

  const { topWatchProviders, providerLink } = useMemo(() => {
    if (!watchProvidersQuery.data?.results) {
      return { topWatchProviders: [], providerLink: undefined };
    }
    const regionData =
      watchProvidersQuery.data.results[region] ??
      watchProvidersQuery.data.results.US;
    if (!regionData) {
      return { topWatchProviders: [], providerLink: undefined };
    }

    const providers: NextUpWatchProvider[] = [];
    const seen = new Set<number>();
    const candidates = [
      ...(regionData.flatrate ?? []),
      ...(regionData.free ?? []),
    ];
    for (const p of candidates) {
      if (!seen.has(p.provider_id)) {
        seen.add(p.provider_id);
        providers.push({
          id: p.provider_id,
          name: p.provider_name,
          logoPath: p.logo_path,
        });
      }
    }
    return {
      topWatchProviders: providers.slice(0, 4),
      providerLink: regionData.link,
    };
  }, [watchProvidersQuery.data, region]);

  const snooze = useCallback(
    (id: string | number, type: MediaType, hours = 24) => {
      setSnoozeMap((prev) => {
        const next = snoozeItem(prev, id, type, hours);
        persistSnoozeMap(next);
        return next;
      });
    },
    [],
  );

  const unsnooze = useCallback((id: string | number, type: MediaType) => {
    setSnoozeMap((prev) => {
      const next = unsnoozeItem(prev, id, type);
      persistSnoozeMap(next);
      return next;
    });
  }, []);

  const remove = useCallback(
    async (id: string | number, type: MediaType) => {
      await repository.removeFromContinueWatching(Number(id), type);
    },
    [repository],
  );

  return {
    queue,
    topItem,
    topEpisodeDetails,
    topWatchProviders,
    providerLink,
    isLoading,
    isSettled,
    snooze,
    unsnooze,
    remove,
  };
}
