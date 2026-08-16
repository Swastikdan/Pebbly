import type { MediaType } from "@/types";

/**
 * Centralized TanStack Query key factory. Every query key is namespaced so
 * `invalidateQueries` / `setQueryData` target exactly the right caches, and
 * mutations can optimistically patch related queries (watchlist list +
 * media-state, lists + list items, etc.).
 *
 * User-specific keys take an optional `userId` so cached data can never cross
 * accounts when the signed-in user changes; callers pass `user?.id` from
 * `useUser()`.
 */
export const queryKeys = {
	watchlist: {
		// Full watchlist (signed-in users) — optional status filter for
		// "continue watching".
		list: (args?: { statusFilter?: string; limit?: number }) =>
			["watchlist", "list", args ?? {}] as const,
		trackedTmdbIds: (userId?: string) =>
			["watchlist", "tracked-ids", userId ?? "anonymous"] as const,
		mediaState: (tmdbId: number, mediaType: MediaType) =>
			["watchlist", "media-state", tmdbId, mediaType] as const,
		episodes: (tmdbId: number) => ["watchlist", "episodes", tmdbId] as const,
		allEpisodes: () => ["watchlist", "all-episodes"] as const,
	},
	lists: {
		all: (userId?: string) => ["lists", "all", userId ?? "anonymous"] as const,
		// Prefix keys used to invalidate every list-items / item-lists query.
		itemsPrefix: () => ["lists", "items"] as const,
		itemListsPrefix: () => ["lists", "item-lists"] as const,
		items: (listId: string, userId?: string) =>
			["lists", "items", listId, userId ?? "anonymous"] as const,
		itemLists: (tmdbId: number, mediaType: MediaType, userId?: string) =>
			[
				"lists",
				"item-lists",
				tmdbId,
				mediaType,
				userId ?? "anonymous",
			] as const,
	},
	permissions: (userId?: string) =>
		["permissions", userId ?? "anonymous"] as const,
	admin: {
		users: (userId?: string) =>
			["admin", "users", userId ?? "anonymous"] as const,
		rolePermissions: () => ["admin", "role-permissions"] as const,
	},
	recommendations: {
		history: (userId?: string) =>
			["recommendations", "history", userId ?? "anonymous"] as const,
		homepage: (userId?: string) =>
			["recommendations", "homepage", userId ?? "anonymous"] as const,
		feedback: (userId?: string) =>
			["recommendations", "feedback", userId ?? "anonymous"] as const,
	},
} as const;
