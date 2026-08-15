import type { MediaType } from "@/types";

/**
 * Centralized TanStack Query key factory. Every query key is namespaced so
 * `invalidateQueries` / `setQueryData` target exactly the right caches, and
 * mutations can optimistically patch related queries (watchlist list +
 * media-state, lists + list items, etc.).
 */
export const queryKeys = {
	watchlist: {
		// Full watchlist (signed-in users) — optional status filter for
		// "continue watching".
		list: (args?: { statusFilter?: string; limit?: number }) =>
			["watchlist", "list", args ?? {}] as const,
		trackedTmdbIds: () => ["watchlist", "tracked-ids"] as const,
		mediaState: (tmdbId: number, mediaType: MediaType) =>
			["watchlist", "media-state", tmdbId, mediaType] as const,
		episodes: (tmdbId: number) => ["watchlist", "episodes", tmdbId] as const,
		allEpisodes: () => ["watchlist", "all-episodes"] as const,
	},
	lists: {
		all: () => ["lists", "all"] as const,
		items: (listId: string) => ["lists", "items", listId] as const,
		itemLists: (tmdbId: number, mediaType: MediaType) =>
			["lists", "item-lists", tmdbId, mediaType] as const,
	},
	permissions: () => ["permissions"] as const,
	recommendations: {
		history: () => ["recommendations", "history"] as const,
		homepage: () => ["recommendations", "homepage"] as const,
	},
} as const;
