import { useCallback, useEffect, useMemo, useState } from "react";

import type { MediaType } from "@/domain/media";
import type { NextUpItem, SnoozeMap } from "@/lib/next-up-engine";
import { useContinueWatching } from "@/hooks/watch-progress/use-watch-progress";
import {
  buildNextUpQueue,
  snoozeItem,
  unsnoozeItem,
} from "@/lib/next-up-engine";
import { useRepository } from "@/lib/repository/use-repository";
import { parseEpisodeKey } from "@/lib/watch-progress";
import { useLocalProgressStore } from "@/stores/local-progress-store";

const SNOOZE_STORAGE_KEY = "pebbly:next_up_snooze";

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
    topItem: queue[0] ?? null,
    isLoading,
    isSettled,
    snooze,
    unsnooze,
    remove,
  };
}
