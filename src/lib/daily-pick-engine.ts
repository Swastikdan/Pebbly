/**
 * Pure candidate-selection engine for "Tonight's Pick". No React, no clocks,
 * no network: the hook (`use-daily-pick.ts`) feeds it data and renders the
 * result; this module decides what today's pick is and in which order
 * candidates appear.
 */

import type { MediaType } from "@/lib/media-types";
import { hashString } from "@/lib/text";

export interface PickItem {
  id: number;
  title: string;
  overview?: string;
  vote_average: number;
  poster_path?: string;
  backdrop_path?: string;
  media_type: MediaType;
  release_date?: string;
  first_air_date?: string;
  isFromWatchlist?: boolean;
  isCurrentlyWatching?: boolean;
  watchProgress?: number;
}

export interface MediaStateInfo {
  progressStatus?: string | null;
  reaction?: string | null;
  progress?: number;
}

export interface WatchlistCandidate {
  external_id: string | number;
  type: MediaType;
  title?: string | null;
  overview?: string | null;
  rating?: number | null;
  image?: string | null;
  release_date?: string | null;
}

export interface DiscoveryCandidate {
  id: number;
  title?: string | null;
  name?: string | null;
  overview?: string | null;
  vote_average?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  media_type?: string;
  release_date?: string | null;
  first_air_date?: string | null;
}

/**
 * Deterministic per-day index into a candidate list. Same day + same list
 * length => same pick; injectable date keeps it testable.
 */
export function getTodaySeedIndex(max: number, date = new Date()): number {
  if (max <= 0) return 0;
  const todayStr = date.toISOString().slice(0, 10);
  return Math.abs(hashString(todayStr)) % max;
}

export function getPickKey(item: PickItem): string {
  return `${item.media_type}:${item.id}`;
}

type TmdbInfoMap = Map<
  string,
  {
    title: string;
    overview?: string;
    poster_path?: string;
    backdrop_path?: string;
    vote_average: number;
    release_date?: string;
    first_air_date?: string;
  }
>;

function buildTmdbInfoMap(
  trending?: DiscoveryCandidate[],
  popularTv?: DiscoveryCandidate[],
): TmdbInfoMap {
  const map: TmdbInfoMap = new Map();
  if (trending) {
    for (const item of trending) {
      const title = item.title ?? item.name;
      const media_type =
        (item.media_type as MediaType) ?? (item.name ? "tv" : "movie");
      if (title && title !== "Unknown Title") {
        map.set(`${media_type}:${item.id}`, {
          title,
          overview: item.overview ?? undefined,
          poster_path: item.poster_path ?? undefined,
          backdrop_path: item.backdrop_path ?? undefined,
          vote_average: item.vote_average ?? 0,
          release_date: item.release_date ?? undefined,
          first_air_date: item.first_air_date ?? undefined,
        });
      }
    }
  }
  if (popularTv) {
    for (const item of popularTv) {
      const title = item.name ?? item.title;
      if (title && title !== "Unknown Title") {
        map.set(`tv:${item.id}`, {
          title,
          overview: item.overview ?? undefined,
          poster_path: item.poster_path ?? undefined,
          backdrop_path: item.backdrop_path ?? undefined,
          vote_average: item.vote_average ?? 0,
          first_air_date: item.first_air_date ?? undefined,
        });
      }
    }
  }
  return map;
}

/**
 * Combine watchlist + discovery sources into one interleaved 50/50 candidate
 * list. Titles already watched or reacted "not-for-me" are excluded; titles
 * currently being watched surface with their progress attached.
 */
export function buildDailyPickCandidates({
  watchlist,
  trending,
  popularTv,
  mediaStateMap,
}: {
  watchlist?: WatchlistCandidate[];
  trending?: DiscoveryCandidate[];
  popularTv?: DiscoveryCandidate[];
  mediaStateMap: Map<string, MediaStateInfo>;
}): PickItem[] {
  const tmdbInfoMap = buildTmdbInfoMap(trending, popularTv);

  const watchlistItems: PickItem[] = [];
  const discoveryItems: PickItem[] = [];
  const seenKeys = new Set<string>();

  const checkFilter = (id: string | number, mediaType: MediaType) => {
    const key = `${mediaType}:${id}`;
    const state = mediaStateMap.get(key);
    if (state?.progressStatus === "done") return { exclude: true };
    if (state?.reaction === "not-for-me") return { exclude: true };
    return {
      exclude: false,
      isCurrentlyWatching: state?.progressStatus === "watching",
      watchProgress: state?.progress ?? 0,
    };
  };

  // 1. Collect Watchlist items
  if (watchlist && watchlist.length > 0) {
    for (const item of watchlist) {
      const key = `${item.type}:${item.external_id}`;
      if (!seenKeys.has(key)) {
        const filterResult = checkFilter(item.external_id, item.type);
        if (filterResult.exclude) continue;

        const tmdbInfo = tmdbInfoMap.get(key);
        const rawTitle = item.title?.trim();
        const validTitle =
          rawTitle && rawTitle !== "Unknown Title" ? rawTitle : tmdbInfo?.title;

        seenKeys.add(key);
        watchlistItems.push({
          id: Number(item.external_id),
          title: validTitle || "Saved Item",
          overview: item.overview || tmdbInfo?.overview,
          vote_average: item.rating || tmdbInfo?.vote_average || 0,
          poster_path: item.image || tmdbInfo?.poster_path,
          backdrop_path: tmdbInfo?.backdrop_path,
          media_type: item.type,
          release_date: item.release_date || tmdbInfo?.release_date,
          first_air_date: tmdbInfo?.first_air_date,
          isFromWatchlist: true,
          isCurrentlyWatching: filterResult.isCurrentlyWatching,
          watchProgress: filterResult.watchProgress,
        });
      }
    }
  }

  // 2. Collect Discovery Media (Trending & Popular TV)
  const addDiscovery = (item: DiscoveryCandidate) => {
    const title = item.title ?? item.name;
    const media_type =
      (item.media_type as MediaType) ?? (item.name ? "tv" : "movie");
    const key = `${media_type}:${item.id}`;
    if (
      !seenKeys.has(key) &&
      title &&
      title !== "Unknown Title" &&
      item.overview &&
      (item.vote_average ?? 0) >= 6.0
    ) {
      const filterResult = checkFilter(item.id, media_type);
      if (filterResult.exclude) return;

      seenKeys.add(key);
      discoveryItems.push({
        id: item.id,
        title,
        overview: item.overview ?? undefined,
        vote_average: item.vote_average ?? 0,
        poster_path: item.poster_path ?? undefined,
        backdrop_path: item.backdrop_path ?? undefined,
        media_type,
        release_date: item.release_date ?? undefined,
        first_air_date: item.first_air_date ?? undefined,
        isFromWatchlist: false,
        isCurrentlyWatching: filterResult.isCurrentlyWatching,
        watchProgress: filterResult.watchProgress,
      });
    }
  };

  if (trending) {
    for (const item of trending) addDiscovery(item);
  }
  if (popularTv) {
    for (const item of popularTv) addDiscovery(item);
  }

  // Interleave 1 Watchlist item for every 1 Discovery item (50/50 balance)
  const blended: PickItem[] = [];
  let wIdx = 0;
  let dIdx = 0;

  while (wIdx < watchlistItems.length || dIdx < discoveryItems.length) {
    if (wIdx < watchlistItems.length) {
      blended.push(watchlistItems[wIdx++]);
    }
    if (dIdx < discoveryItems.length) {
      blended.push(discoveryItems[dIdx++]);
    }
  }

  return blended;
}
