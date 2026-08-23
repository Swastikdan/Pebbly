import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MediaType } from "@/lib/media-types";
import type { MediaListResultsEntity } from "@/lib/tmdb-schemas";
import { createLRUStorage, createMemoryStorage } from "@/lib/utils";

/**
 * Offline cache for the "What to Watch Today" picker.
 *
 * The daily pick sources its discovery buckets from live TMDB requests; this
 * store persists the last successful payload (and per-title backdrop/poster
 * paths) using the same Zustand `persist` + LRU-localStorage pattern as the
 * watchlist / custom-list stores, so the picker still works when offline or on
 * a flaky connection.
 */

/** Minimal per-title info persisted so the pick tile renders offline. */
export interface DailyPickCachedDetail {
  backdrop_path?: string | null;
  poster_path?: string | null;
}

const DETAILS_CACHE_MAX = 100;

interface DailyPickStore {
  trendingMedia: MediaListResultsEntity[];
  popularTv: MediaListResultsEntity[];
  details: Record<string, DailyPickCachedDetail>;
  lastFetchedAt: number;
  setTrending: (items: MediaListResultsEntity[]) => void;
  setPopularTv: (items: MediaListResultsEntity[]) => void;
  setDetail: (
    mediaType: MediaType,
    id: number,
    detail: DailyPickCachedDetail,
  ) => void;
  clear: () => void;
}

const lruStorage = createLRUStorage();
const memoryStorage = createMemoryStorage();

export const useDailyPickStore = create<DailyPickStore>()(
  persist(
    (set) => ({
      trendingMedia: [],
      popularTv: [],
      details: {},
      lastFetchedAt: 0,

      setTrending: (items) =>
        set((state) => ({
          trendingMedia: items,
          lastFetchedAt: items.length > 0 ? Date.now() : state.lastFetchedAt,
        })),

      setPopularTv: (items) =>
        set((state) => ({
          popularTv: items,
          lastFetchedAt: items.length > 0 ? Date.now() : state.lastFetchedAt,
        })),

      setDetail: (mediaType, id, detail) =>
        set((state) => {
          const key = `${mediaType}:${id}`;
          // Bound the map so a long-lived session can't grow it without
          // limit (LRU storage already caps total bytes).
          const entries = Object.entries(state.details);
          const next = { ...state.details, [key]: detail };
          if (entries.length >= DETAILS_CACHE_MAX && !(key in state.details)) {
            // Drop the oldest entry.
            const [oldestKey] = entries;
            if (oldestKey) delete next[oldestKey[0]];
          }
          return { details: next };
        }),

      clear: () =>
        set({
          trendingMedia: [],
          popularTv: [],
          details: {},
          lastFetchedAt: 0,
        }),
    }),
    {
      name: "daily-pick-storage",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? lruStorage : memoryStorage,
      ),
    },
  ),
);
