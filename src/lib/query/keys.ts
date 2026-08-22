import type { MediaType } from "@/types";

export const queryKeys = {
	watchlist: {
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
		// Owner/visitor payload for /c/$id; viewer-dependent on purpose (the
		// server fn resolves owner vs public per request), so no userId in key.
		collectionPage: (listId: string) =>
			["lists", "collection-page", listId] as const,
	},
	permissions: (userId?: string) =>
		["permissions", userId ?? "anonymous"] as const,
	data: {
		version: (userId?: string) =>
			["data", "version", userId ?? "anonymous"] as const,
	},
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
	tmdb: {
		movieDetails: (id: number) => ["movie_details", id] as const,
		tvDetails: (id: number) => ["tv_details", id] as const,
		basicMovieDetails: (id: number) => ["basic_movie_details", id] as const,
		basicTvDetails: (id: number) => ["basic_tv_details", id] as const,
		seasonDetails: (tvId: number, season: number) =>
			["tv_season_details", tvId, season] as const,
		personDetails: (id: number) => ["person_details", id] as const,
		collection: (id: number) => ["collection", id] as const,
		recommendations: (mediaType: MediaType, id: number) =>
			[`${mediaType}_recommendations`, id] as const,
		credits: (id: number, mediaType: MediaType) =>
			["media-credits", id, mediaType] as const,
		videos: (id: number, mediaType: MediaType) =>
			["media_videos", id, mediaType] as const,
		images: (id: number, mediaType: MediaType) =>
			["media_images", id, mediaType] as const,
		mediaList: (type: string, page: number) =>
			["media-list", type, page] as const,
		discoverKeyword: (id: number, page: number) =>
			["discover-movies-keyword", id, page] as const,
		search: (query: string, page: number) => ["search", query, page] as const,
		searchFallback: (title: string, mediaType: MediaType) =>
			["tmdb_search_fallback", title, mediaType] as const,
		trendingDay: () => ["trending_day"] as const,
		homepageMedia: (type: string) => [type] as const,
		continueWatching: (id: string | number, mediaType: MediaType) =>
			["continue-watching", id, mediaType] as const,
		dailyPickTrending: () => ["daily-pick-trending"] as const,
		dailyPickPopularTv: () => ["daily-pick-popular-tv"] as const,
		dailyPickDetails: (mediaType: "movie" | "tv", id: number) =>
			["daily-pick-details", mediaType, id] as const,
	},
} as const;
