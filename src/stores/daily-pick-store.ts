import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MediaType } from "@/lib/media-types";
import type { MediaListResultsEntity } from "@/lib/tmdb-schemas";
import { createLRUStorage, createMemoryStorage } from "@/lib/utils";

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
          const entries = Object.entries(state.details);
          const next = { ...state.details, [key]: detail };
          if (entries.length >= DETAILS_CACHE_MAX && !(key in state.details)) {
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
