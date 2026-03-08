/** Zustand store for tracking episode watched status in localStorage (logged-out users). */
import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

import { createMemoryStorage } from "@/lib/utils";

interface LocalProgressStore {
	watchedEpisodes: Record<string, boolean>; // key format: `${tmdbId}:${season}:${episode}`

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
}

const memoryStorage = createMemoryStorage();

export const useLocalProgressStore = create<LocalProgressStore>()(
	persist(
		(set) => ({
			watchedEpisodes: {},

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
		{
			name: "local-progress-store",
			storage: createJSONStorage(() =>
				typeof window !== "undefined" ? window.localStorage : memoryStorage,
			),
		},
	),
);
