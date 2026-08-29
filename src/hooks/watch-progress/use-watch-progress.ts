import { useUser } from "@clerk/react";
import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { MediaType } from "@/domain/media";
import type { ProgressStatus } from "@/domain/watchlist";
import type {
  EpisodeWatchedMap,
  ShowMetadata,
  WatchProgressData,
} from "@/lib/watch-progress";
import {
  fetchWatchedEpisodes,
  fetchWatchlistListFiltered,
} from "@/lib/data/watchlist-queries";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import { logWatchProgressError, makeEpisodeKey } from "@/lib/watch-progress";
import { useLocalProgressStore } from "@/stores/local-progress-store";
import { useMediaState, useWatchlistStore } from "../use-watchlist";

export type {
  EpisodeWatchedMap,
  ShowMetadata,
  WatchProgressData,
} from "@/lib/watch-progress";

export function useWatchProgress(id: string | number, mediaType: MediaType) {
  const mediaState = useMediaState(String(id), mediaType);
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const tmdbId = Number(id);

  const watchedEpisodesQuery = useQuery({
    queryKey: queryKeys.watchlist.episodes(tmdbId),
    queryFn: () => fetchWatchedEpisodes(queryClient, tmdbId),
    enabled: !!isSignedIn && mediaType === "tv",
  });
  const watchedEpisodes = watchedEpisodesQuery.data ?? [];

  const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);

  const lastPlayed = useLocalProgressStore(
    (state) => state.lastPlayed[String(id)] ?? null,
  );

  const progress: WatchProgressData | null = useMemo(() => {
    if (!mediaState) return null;

    let context: { season?: number; episode?: number } | undefined;

    if (mediaType === "tv") {
      if (lastPlayed) {
        const { season, episode } = lastPlayed;
        const isThisWatched = isSignedIn
          ? watchedEpisodes.some(
              (e) =>
                e.season === season && e.episode === episode && e.isWatched,
            )
          : !!localEpisodes[`${tmdbId}:${season}:${episode}`];

        if (isThisWatched) {
          context = { season, episode: episode + 1 };
        } else {
          context = { season, episode };
        }
      }

      if (!context) {
        const watchedList = isSignedIn
          ? watchedEpisodes
              .filter((e) => e.isWatched)
              .map((e) => ({ season: e.season, episode: e.episode }))
          : Object.entries(localEpisodes)
              .filter(([key, val]) => key.startsWith(`${tmdbId}:`) && val)
              .map(([key]) => {
                const [, s, e] = key.split(":");
                return { season: Number(s), episode: Number(e) };
              });

        if (watchedList.length > 0) {
          watchedList.sort((a, b) => {
            if (a.season !== b.season) return a.season - b.season;
            return a.episode - b.episode;
          });
          const lastWatched = watchedList[watchedList.length - 1];
          context = {
            season: lastWatched.season,
            episode: lastWatched.episode + 1,
          };
        } else {
          context = {
            season: 1,
            episode: 1,
          };
        }
      }
    }

    return {
      id: String(mediaState.external_id),
      type: mediaState.type,
      timestamp: 0,
      percent: mediaState.progress ?? 0,
      duration: 0,
      lastUpdated: mediaState.updated_at,
      context,
    };
  }, [
    mediaState,
    mediaType,
    isSignedIn,
    watchedEpisodes,
    localEpisodes,
    tmdbId,
    lastPlayed,
  ]);

  return { progress };
}

export function useContinueWatching() {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const remote = useQuery({
    queryKey: queryKeys.watchlist.list({ statusFilter: "watching", limit: 50 }),
    queryFn: () =>
      fetchWatchlistListFiltered(queryClient, {
        statusFilter: "watching",
        limit: 50,
      }),
    enabled: !!isSignedIn,
  });
  const localMediaState = useWatchlistStore((state) => state.mediaState);

  const isLoading = isSignedIn ? remote.isLoading || remote.isFetching : false;
  const isSettled = isSignedIn ? !!remote.data || remote.isError : true;

  const items = useMemo(() => {
    if (isSignedIn) {
      if (!remote.data) return [];
      // The server filters by status (SQL `progressStatus = 'watching'`) and
      // no optimistic op writes this filtered cache, so rows are trusted.
      return remote.data
        .map((item) => ({
          id: String(item.tmdbId),
          type: item.mediaType as MediaType,
          timestamp: 0,
          percent: item.progress ?? 0,
          duration: 0,
          lastUpdated: item.updatedAt,
          title: item.title ?? undefined,
          image: item.image ?? undefined,
          rating: item.rating ?? undefined,
          release_date: item.releaseDate ?? undefined,
          overview: item.overview ?? undefined,
        }))
        .sort((a, b) => b.lastUpdated - a.lastUpdated);
    }

    return localMediaState
      .filter((item) => item.progressStatus === "watching")
      .map((item) => ({
        id: String(item.external_id),
        type: item.type,
        timestamp: 0,
        percent: item.progress ?? 0,
        duration: 0,
        lastUpdated: item.updated_at,
        title: item.title,
        image: item.image,
        rating: item.rating,
        release_date: item.release_date,
        overview: item.overview,
      }))
      .sort((a, b) => b.lastUpdated - a.lastUpdated);
  }, [isSignedIn, remote.data, localMediaState]);

  return { items, isLoading, isSettled };
}

export function useRemoveFromContinueWatching() {
  const repository = useRepository();

  const removeFromContinueWatching = useCallback(
    async (tmdbId: number, mediaType: MediaType) => {
      try {
        await repository.removeFromContinueWatching(tmdbId, mediaType);
      } catch (error) {
        logWatchProgressError("remove item from continue watching", error);
      }
      // Local-only player state (episode marks, last-played) that no server
      // write can reach; cleared so resume context disappears everywhere.
      useLocalProgressStore.getState().clearShowProgress(tmdbId);
    },
    [repository],
  );

  return { removeFromContinueWatching };
}

export function useEpisodeWatched(
  tvId: number | string,
  totalEpisodes?: number,
  showMeta?: ShowMetadata,
) {
  const tmdbId = Number(tvId);
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const mediaState = useMediaState(String(tvId), "tv");
  const watchedEpisodesQuery = useQuery({
    queryKey: queryKeys.watchlist.episodes(tmdbId),
    queryFn: () => fetchWatchedEpisodes(queryClient, tmdbId),
    enabled: !!isSignedIn,
  });
  const watchedEpisodes = watchedEpisodesQuery.data ?? [];
  const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);
  const repository = useRepository();
  const showMetadata = useMemo(
    () => ({
      title: showMeta?.title ?? `TV Show ${tvId}`,
      image: showMeta?.image ?? "",
      rating: showMeta?.rating ?? 0,
      release_date: showMeta?.release_date ?? "",
      overview: showMeta?.overview,
    }),
    [tvId, showMeta],
  );

  const watchedMap = useMemo(() => {
    const map: EpisodeWatchedMap = {};

    if (!isSignedIn) {
      const prefix = `${tmdbId}:`;
      for (const [key, value] of Object.entries(localEpisodes)) {
        if (key.startsWith(prefix) && value) {
          map[key] = true;
        }
      }
      return map;
    }

    for (const episode of watchedEpisodes) {
      if (episode.isWatched) {
        map[makeEpisodeKey(tmdbId, episode.season, episode.episode)] = true;
      }
    }

    return map;
  }, [watchedEpisodes, tmdbId, localEpisodes, isSignedIn]);

  const watchedCount = Object.keys(watchedMap).length;

  const hasMediaState = !!mediaState;
  const currentProgress = mediaState?.progress ?? 0;
  const currentProgressStatus = mediaState?.progressStatus ?? null;

  const hasEpisodeTotal =
    typeof totalEpisodes === "number" && totalEpisodes > 0;
  const safeTotalEpisodes = hasEpisodeTotal ? totalEpisodes : 0;

  const { derivedProgress, derivedStatus } = useMemo(() => {
    const progress =
      watchedCount <= 0
        ? 0
        : hasEpisodeTotal
          ? Math.min(100, Math.floor((watchedCount / safeTotalEpisodes) * 100))
          : Math.max(currentProgress, 1);

    const status =
      watchedCount <= 0
        ? "watch-later"
        : hasEpisodeTotal && watchedCount >= safeTotalEpisodes
          ? "done"
          : "watching";

    return { derivedProgress: progress, derivedStatus: status };
  }, [watchedCount, hasEpisodeTotal, safeTotalEpisodes, currentProgress]);

  useEffect(() => {
    if (!hasMediaState && watchedCount === 0) return;
    if (currentProgressStatus === "dropped") return;

    // Leaving completion is owned by explicit actions too. Our episode
    // count can be stale or partial (long-running shows, in-flight syncs),
    // and a low derived percent must never demote a status the user set.
    if (currentProgressStatus === "done" && derivedStatus !== "done") return;

    const shouldWriteProgress =
      !hasMediaState || currentProgress !== derivedProgress;
    const shouldWriteStatus = currentProgressStatus !== derivedStatus;

    if (!shouldWriteProgress && !shouldWriteStatus) return;

    // Leaving "watching" only ever moves the resume position; status
    // transitions out of watching are owned by explicit user actions.
    if (currentProgressStatus === "watching" && derivedStatus !== "watching") {
      if (shouldWriteProgress) {
        void repository
          .updateProgress({
            tmdbId,
            mediaType: "tv",
            progress: derivedProgress,
            ...showMetadata,
          })
          .catch((error) => logWatchProgressError("sync TV progress", error));
      }
      return;
    }

    if (shouldWriteStatus) {
      void repository
        .updateProgress({
          tmdbId,
          mediaType: "tv",
          progress: derivedProgress,
          progressStatus: derivedStatus as ProgressStatus,
          ...showMetadata,
        })
        .catch((error) =>
          logWatchProgressError("sync TV progress status", error),
        );
    } else if (shouldWriteProgress) {
      void repository
        .updateProgress({
          tmdbId,
          mediaType: "tv",
          progress: derivedProgress,
          ...showMetadata,
        })
        .catch((error) => logWatchProgressError("sync TV progress", error));
    }
  }, [
    derivedProgress,
    derivedStatus,
    currentProgress,
    currentProgressStatus,
    hasMediaState,
    watchedCount,
    repository,
    showMetadata,
    tmdbId,
  ]);

  const isEpisodeWatched = useCallback(
    (season: number, episode: number) => {
      return !!watchedMap[makeEpisodeKey(tmdbId, season, episode)];
    },
    [watchedMap, tmdbId],
  );

  const toggleEpisodeWatched = useCallback(
    (season: number, episode: number) => {
      void repository
        .markEpisode({
          tmdbId,
          season,
          episode,
          isWatched: !isEpisodeWatched(season, episode),
        })
        .catch((error) =>
          logWatchProgressError("toggle episode watched", error),
        );
    },
    [isEpisodeWatched, repository, tmdbId],
  );

  const markSeasonWatched = useCallback(
    (season: number, episodes: number[]) => {
      void repository
        .markSeason({ tmdbId, season, episodes, isWatched: true })
        .catch((error) =>
          logWatchProgressError("mark season episodes watched", error),
        );
    },
    [repository, tmdbId],
  );

  const unmarkSeasonWatched = useCallback(
    (season: number, episodes: number[]) => {
      void repository
        .markSeason({ tmdbId, season, episodes, isWatched: false })
        .catch((error) =>
          logWatchProgressError("unmark season episodes watched", error),
        );
    },
    [repository, tmdbId],
  );

  const getSeasonWatchedCount = useCallback(
    (season: number, totalEpisodesCount: number) => {
      let count = 0;
      for (let episode = 1; episode <= totalEpisodesCount; episode++) {
        if (watchedMap[makeEpisodeKey(tmdbId, season, episode)]) {
          count++;
        }
      }

      return count;
    },
    [tmdbId, watchedMap],
  );

  const isSeasonFullyWatched = useCallback(
    (season: number, totalEpisodesCount: number) => {
      if (totalEpisodesCount === 0) return false;
      return (
        getSeasonWatchedCount(season, totalEpisodesCount) === totalEpisodesCount
      );
    },
    [getSeasonWatchedCount],
  );

  return {
    isEpisodeWatched,
    toggleEpisodeWatched,
    markSeasonWatched,
    unmarkSeasonWatched,
    isSeasonFullyWatched,
    getSeasonWatchedCount,
    watchedCount,
  };
}

export function useEpisodeProgress(
  tvId: string | number,
  season: number,
  episode: number,
) {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();

  const data = useQuery({
    queryKey: queryKeys.watchlist.episodes(Number(tvId)),
    queryFn: () => fetchWatchedEpisodes(queryClient, Number(tvId)),
    enabled: !!isSignedIn,
  });

  const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);

  return useMemo(() => {
    if (isSignedIn) {
      const isWatched = !!data.data?.some(
        (e) => e.season === season && e.episode === episode && e.isWatched,
      );
      return isWatched ? 100 : 0;
    }
    return localEpisodes[makeEpisodeKey(tvId, season, episode)] ? 100 : 0;
  }, [isSignedIn, data.data, localEpisodes, tvId, season, episode]);
}
