import { create } from "zustand";
import { persist } from "zustand/middleware";

import { guestPersistOptions } from "./guest-store-kit";

interface LocalProgressStore {
  watchedEpisodes: Record<string, boolean>;

  /** Last played episode per show id (`{tmdbId}` -> `{season, episode}`). */
  lastPlayed: Record<string, { season: number; episode: number }>;

  markEpisodeWatched: (
    tmdbId: number,
    season: number,
    episode: number,
    isWatched: boolean,
  ) => void;

  markSeasonWatched: (
    tmdbId: number,
    season: number,
    episodes: number[],
    isWatched: boolean,
  ) => void;

  clearShowProgress: (tmdbId: number) => void;

  setLastPlayed: (id: string, season: number, episode: number) => void;
}

export const useLocalProgressStore = create<LocalProgressStore>()(
  persist(
    (set) => ({
      watchedEpisodes: {},
      lastPlayed: {},

      setLastPlayed: (id, season, episode) =>
        set((state) => ({
          lastPlayed: { ...state.lastPlayed, [id]: { season, episode } },
        })),

      markEpisodeWatched: (tmdbId, season, episode, isWatched) =>
        set((state) => {
          const key = `${tmdbId}:${season}:${episode}`;
          const newEpisodes = { ...state.watchedEpisodes };

          if (isWatched) newEpisodes[key] = true;
          else delete newEpisodes[key];

          return { watchedEpisodes: newEpisodes };
        }),

      markSeasonWatched: (tmdbId, season, episodes, isWatched) =>
        set((state) => {
          const newEpisodes = { ...state.watchedEpisodes };

          for (const episode of episodes) {
            const key = `${tmdbId}:${season}:${episode}`;
            if (isWatched) newEpisodes[key] = true;
            else delete newEpisodes[key];
          }

          return { watchedEpisodes: newEpisodes };
        }),

      clearShowProgress: (tmdbId) =>
        set((state) => {
          const newEpisodes = { ...state.watchedEpisodes };
          const prefix = `${tmdbId}:`;

          for (const key of Object.keys(newEpisodes)) {
            if (key.startsWith(prefix)) delete newEpisodes[key];
          }

          return { watchedEpisodes: newEpisodes };
        }),
    }),
    guestPersistOptions("local-progress-store", "localStorage"),
  ),
);
