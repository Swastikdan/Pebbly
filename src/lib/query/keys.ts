import type { MediaType } from "@/types";

/**
 * Centralized TanStack Query key factory. Every query key is namespaced so
 * `invalidateQueries` / `setQueryData` target exactly the right caches, and
 * mutations can optimistically patch related queries (watchlist list,
 * lists + list items, etc.).
 *
 * User-specific keys take an optional `userId` so cached data can never cross
 * accounts when the signed-in user changes; callers pass `user?.id` from
 * `useUser()`.
 */
export const queryKeys = {
  watchlist: {
    // Full watchlist (signed-in users), optional status filter for
    // "continue watching".
    list: (args?: { statusFilter?: string; limit?: number }) =>
      ["watchlist", "list", args ?? {}] as const,
    trackedTmdbIds: (userId?: string) =>
      ["watchlist", "tracked-ids", userId ?? "anonymous"] as const,
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
    // Owner/visitor payload for the /c/$id collection page. Viewer-dependent
    // on purpose: the server fn resolves owner vs public per request.
    collectionPage: (listId: string) =>
      ["lists", "collection-page", listId] as const,
  },
  permissions: (userId?: string) =>
    ["permissions", userId ?? "anonymous"] as const,
  // Combined per-user revision counters (watchlist / lists / AI recs) polled
  // to detect cross-device changes without re-fetching whole collections.
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
  /**
   * TMDB content caches. Every raw-literal content key lives here so
   * loaders, components and repositories share exactly one cache entry per
   * payload (and a rename stays a one-place change).
   */
  tmdb: {
    movieDetails: (id: number) => ["movie_details", id] as const,
    tvDetails: (id: number) => ["tv_details", id] as const,
    // Canonical basic-details keys; the legacy `basic_movie-details`
    // spelling was a second cache of the same payload.
    basicMovieDetails: (id: number) => ["basic_movie_details", id] as const,
    basicTvDetails: (id: number) => ["basic_tv_details", id] as const,
    // One season-detail cache shared by the batched hook, season pages and
    // the inline episode browser.
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
    dailyPickDetails: (mediaType: MediaType, id: number) =>
      ["daily-pick-details", mediaType, id] as const,
  },
} as const;

/**
 * The three query groups every lists write must keep fresh. Single source of
 * truth shared by the repository's journal sync and UserSync's cross-device
 * invalidation so the two can't drift.
 */
export const listsSyncKeys = (userId?: string) =>
  [
    queryKeys.lists.all(userId),
    queryKeys.lists.itemsPrefix(),
    queryKeys.lists.itemListsPrefix(),
  ] as const;
