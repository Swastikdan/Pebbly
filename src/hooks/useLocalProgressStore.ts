import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

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

const memoryStorage: Storage = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (name) => (name in store ? store[name] : null),
		setItem: (name, value) => {
			store[name] = String(value);
		},
		removeItem: (name) => {
			delete store[name];
		},
		clear: () => {
			store = {};
		},
		key: (index) => Object.keys(store)[index] ?? null,
		get length() {
			return Object.keys(store).length;
		},
	} as Storage;
})();

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
