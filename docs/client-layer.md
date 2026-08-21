# Client layer

The client is a React 19 SPA rendered by TanStack Start (SSR on the Worker,
hydration in the browser). It combines TanStack Query (server data),
Zustand (local/guest state), and a repository pattern that hides whether a
mutation goes to the server or to local storage.

## 1. App shell & bootstrapping

- `src/start.ts`, client start instance. **Key behavior:** every server-fn
  RPC is wrapped with a fresh Clerk session token
  (`Authorization: Bearer <token>`, minted/rotated by the Clerk SDK) and a 30 s
  abort timeout. Also installs `createCsrfMiddleware` scoped to server fns so
  cookie-derived sessions can't be abused cross-site.
- `src/router.tsx`, builds the router: `ClerkProvider` (shadcn theme) wraps
  `QueryProvider`, which provides the TanStack Query client. Sets
  `defaultStaleTime: 30s`, scroll restoration, case-sensitive routes, and the
  default pending / not-found / error components. `setupRouterSsrQueryIntegration`
  wires router loaders to the query cache with redirect handling.
- `src/routeTree.gen.ts`, generated route tree (do not edit).
- `src/routes/__root.tsx`, the root layout: meta tags, nav bar, footer,
  mobile bottom nav, toaster, `UserSync`, skip-to-content link, and app CSS.

## 2. Data fetching (TanStack Query)

- `src/lib/query/query-client.ts`, `getContext()` creates a fresh QueryClient
  per render/request with sane defaults (24 h staleTime, 30 min gcTime, retry 1,
  no refetch on window focus). TMDB data is treated as fresh for a day to avoid
  refetch churn, but `gcTime` (how long *unused* queries stay resident) is kept
  short so visited page payloads are evicted from memory instead of
  accumulating to hundreds of MB over a session. A fresh client per SSR
  request keeps journal state (see pending-ops) from leaking between requests.
- `src/lib/query/root-provider.tsx`, React context provider for the client.
- `src/lib/query/devtools.ts`, dev-only React Query devtools toggle.
- `src/lib/query/keys.ts`, `queryKeys` factory: namespaced, user-scoped keys
  (`watchlist.*`, `lists.*`, `permissions`, `admin.*`,
  `recommendations.*`, `data.version` for the combined revision poll).
  User-scoping (`?? "anonymous"`) prevents cached data from leaking across
  accounts.
- `src/lib/queries.ts`, TMDB query functions used by routes/components
  (`getMediaList`, `getMovieDetails`, `getTvDetails`, `getCredits`,
  `getSearchResult`, `getPersonDetails`, ...). `MEDIA_LIST_PATHS` is the single
  source of truth for list endpoints; `safeFetch` logs rich errors in dev.
- `src/lib/tmdb.ts`, the `@better-fetch/fetch` client for TMDB: bearer
  token, 15 s timeout, linear retry (2 attempts) on 408/429/5xx.
- `src/lib/tmdb-schemas.ts`, Valibot schemas for every TMDB response shape
  (742 lines). Query functions validate responses against these.
- `src/lib/server-types.ts`, client-side aliases of D1 row types
  (`WatchItemRow`, `EpisodeProgressRow`, `CustomListRow`, ...).

## 3. State management (Zustand)

| Store | File | Purpose |
| :--- | :--- | :--- |
| `useWatchlistStore` | `src/hooks/watchlist-store.ts` | Guest watchlist (`mediaState`), persisted to localStorage with LRU eviction; mutators `setWatchlistMembershipLocal`, `setProgressStatusLocal`, `setReactionLocal`, `setProgressLocal`, `importWatchlistLocal` |
| `useLocalListsStore` | `src/hooks/use-local-lists-store.ts` | Guest custom lists |
| `useLocalProgressStore` | `src/hooks/use-local-progress-store.ts` | Guest episode/progress state (`lastPlayed`, watched episodes) |
| `useDailyPickStore` | `src/hooks/use-daily-pick-store.ts` | Daily-pick seed/date bookkeeping |
| `useToastStore` | `src/hooks/use-toast-store.ts` | Toast notifications |

- `src/lib/utils.ts`, `createLRUStorage()` wraps localStorage with LRU
  eviction (~4 MB threshold) so several persisted stores can't blow the quota;
  `createMemoryStorage()` is the SSR-safe fallback. Also: `cn` (clsx +
  tailwind-merge), `normalizeProgressStatus`, `validateId` /
  `parseAndValidateId` (strict TMDB id parsing), and `formatMediaTitle`
  (slug encode/decode with diacritic stripping).

## 4. The repository pattern (`src/lib/repository/`)

The mutation layer that eliminated the old `if (isSignedIn)` branches:

- `types.ts`, `WatchlistRepository` + `ListsRepository` interfaces and the
  shared `resolveProgressStatusAction` decision tree (TV vs movie progress
  writes: mark watched, leave completion, episode sync needed, progress value).
- `use-repository.ts`, `useRepository()` returns the remote implementation
  when signed in, the local one otherwise (memoized per auth state).
- `remote-repository.ts`, server-backed implementation:
  - watchlist membership writes go through a shared `RequestBatcher`
    (300 ms debounce / 1.2 s max wait / dedupe by `mediaType:tmdbId` /
    flush on page hide), then `setWatchlistMembership` or
    `batchSetWatchlistMembership`; the authoritative rows are merged into the
    cache with `applyServerState`.
  - progress status / reactions / episode syncs run through
    `runJournaledMutation` (begin op → run fn → resolve/rollback → schedule
    sync). TV writes fetch show details first to build the season/episode
    selection (`buildSeasonEpisodeSelections`).
  - custom-list CRUD wraps each server fn with optimistic ops + id swapping
    (optimistic temp id → real id) + cache sync.
  - Successful server writes call `recordOwnMutation` (see
    `realtime-mutations.ts`) so the realtime poll can tell this client's own
    changes apart from external ones.
- `local-repository.ts`, the same interface against the Zustand stores
  (watchlist store + local lists/progress stores). TV progress uses the same
  `resolveProgressStatusAction` and `buildSeasonEpisodeSelections`.

## 5. Optimistic updates (`src/hooks/pending-ops.ts`)

A replayable journal for array-shaped query caches (watchlist, lists):

- `beginOp(queryClient, entries)` registers a set of pure `apply(rows)` patches
  and applies them immediately. **Throws during SSR.** Optimistic ops are
  client-only by construction.
- Journal state is scoped to the QueryClient via a WeakMap (never module-level
  globals), so concurrent SSR requests can't bleed into each other.
- Ops that touch the same rows supersede each other (latest intent wins),
  matching the server batcher's dedupe.
- `reconcileListFetch` / `applyServerState` merge fresh server snapshots by
  *replaying still-pending ops on top*, so a snapshot computed before a write
  committed can never clobber newer optimistic state (kills the UI-flicker
  race).
- `resolve` (success) folds the op into the journal base; `remove` (failure)
  rebuilds the cache from base + remaining ops, so a failed write rolls back
  only its own rows, not the whole array.
- `scheduleSync` debounces cache invalidations (250 ms) so N rapid mutations
  produce one refetch.
- `clearPendingOps` is called on sign-out.

Optimistic op builders live in:
- `src/hooks/watchlist/watchlist-optimistic.ts`, membership/progress/reaction/
  mark-show op builders.
- `src/hooks/custom-lists/list-optimistic.ts`, list CRUD op builders
  (`beginCreateListOp`, `beginToggleListItemOp`, `swapListId`, ...).
- `src/hooks/optimistic-helpers.ts`, small shared helpers.

## 6. Feature hooks

- `use-watchlist.ts`, read hook for the signed-in watchlist (list, tracked
  ids, media state, episodes) via `watchlist-queries.ts`.
- `use-watchlist-import-export.ts`, export/import of watchlists (JSON),
  including the local→remote promotion on sign-in.
- `use-custom-lists.ts`, custom-list reads + mutations (delegates to the
  repository).
- `use-recommendations.ts`, AI recommendation queries/mutations (history,
  generate, feedback, verified resolution).
- `use-daily-pick.ts`, daily-pick selection logic (seeded randomness, media
  interleaving, scoring) extracted from the `daily-pick.tsx` component.
- `use-season-details.ts`, batched TV season-detail fetching (a shared
  `RequestBatcher` so a continue-watching strip of N cards coalesces its TMDB
  requests).
- `use-filtered-watchlist.ts`, filter/sort state for the watchlist page.
- `use-permissions.ts`, client-side RBAC summary (roles, features, admin,
  banned) from `getUserFeaturesFn`. Polls every 30 s while the tab is visible
  so ban status / feature flags stay fresh (this is what signs a banned user
  out automatically via `user-sync.tsx`).
- `use-watch-progress` (`src/hooks/watch-progress/`), player progress
  tracking: `use-watch-progress.ts` (677 lines), `use-player-listener.ts`
  (postMessage listener that trusts sources by origin, with a DOM-scan
  fallback), `progress-helpers.ts` (pure progress math + types).

## 7. Cross-device realtime (`src/hooks/data-version.ts` + `src/lib/realtime-mutations.ts`)

Convex's realtime subscriptions are replaced by **version-gated polling**
(see ADR-015):

- `src/lib/realtime-mutations.ts`, per-domain counters (`watchlist` / `lists`
  / `ai`) of this client's **successful** server writes, recorded by the
  repository and the mutation hooks at every rev-bumping call site.
- `src/hooks/data-version.ts`, `fetchDataVersion`, the client fetch for the
  combined per-user revision counters.
- `user-sync.tsx`, polls `data.version` every 10 s (pauses on hidden tabs)
  and tracks the last-seen revisions per user. When a revision moves **beyond
  what the client's own mutations can explain**, it invalidates the matching
  query group (watchlist list / lists / AI history), so mounted queries
  refetch. Own writes never trigger a redundant refetch; external changes
  always do. Per-poll cost is 1 row read regardless of collection size.

## 7. Routing & pages (`src/routes/`)

- Static shells with head metadata + search-param validation: `search.tsx`,
  `watchlist.tsx`, `recommendations.tsx`, `admin.tsx`, `disclaimer.tsx`.
- Lazy UI variants: `search.lazy.tsx`, `watchlist.lazy.tsx`,
  `recommendations.lazy.tsx`.
- Discovery pages: `index.tsx` (homepage with trending rows, daily pick, AI
  picks), `list.$type.$slug.tsx` (popular/top-rated/... lists with
  pagination), `person.$id.tsx`, `keyword.$id.tsx`,
  `collection.$id.{-$slug}.tsx`.
- Detail pages: `movie/$id/{-$slug}/index.tsx` (+ `media.tsx`,
  `cast-crew.tsx`) and `tv/$id/{-$slug}/index.tsx` (+ `seasons.tsx`,
  `season.$seasonNumber.tsx`, `media.tsx`, `cast-crew.tsx`). All use
  `useCanonicalSlugRedirect` to normalize `/{id}/{slug}` URLs.
- `api.metaimage.ts`, OG-image redirect endpoint: resolves a title to its
  TMDB poster/backdrop and 302-redirects to a cached image URL (with
  placeholder fallback).

## 8. Components (`src/components/`)

- `ui/`, shadcn-style primitives + `media-grid.tsx`, `search-bar.tsx`,
  `lazy-section.tsx`, `auto-scroll-title.tsx`, `toaster.tsx`, `image.tsx`.
- `media/`, detail-page blocks: `media-container.tsx` (layout),
  `media-title-container.tsx`, `media-video-image-container.tsx`,
  `media-poster-trailer-container.tsx`, `watchlist-status-menu.tsx`,
  `reaction-selector.tsx`, `cast-section.tsx`, `media-credit-section.tsx`,
  `season-container.tsx`, `current-season.tsx`, `inline-episode-browser.tsx`,
  `collections.tsx`, `genre-container.tsx`, `media-keywords.tsx`,
  `media-lightbox-dialog.tsx`, `rating-count.tsx`, `media-description.tsx`,
  `media-recommendation.tsx`.
- `watchlist/`, `watchlist-grid.tsx`, `watchlist-card.tsx`,
  `watchlist-filters.tsx`, `list-collage.tsx`, `custom-list-view.tsx`,
  `custom-list-card.tsx`, `custom-list-media-card.tsx`,
  `silent-error-boundary.tsx`.
- `recommendations/`, `recommendation-filters.tsx`, `recommendation-results.tsx`,
  `recommendation-history.tsx`, `loading-skeletons.tsx`, `recommendation-utils.ts`.
- `admin/`, `admin-dashboard.tsx`, `admin-user-table.tsx` (orchestrator),
  `admin-user-row.tsx`, `admin-role-dialog.tsx`, `admin-permission-toggles.tsx`,
  `use-admin-users.ts` (data hook; polls every 10 s while the admin page is
  open, the page is admin-gated client- and server-side, so non-admins never
  fetch it).
- Top-level widgets: `navbar.tsx`, `footer.tsx`, `mobile-bottom-nav.tsx`,
  `desktop-nav-button.tsx`, `media-card.tsx`, `homepage-media.tsx`,
  `homepage-recommendations.tsx`, `daily-pick.tsx`, `video-player-modal.tsx`,
  `watchlist-button.tsx`, `custom-list-dialog.tsx`, `custom-list-picker.tsx`,
  `filter-bar.tsx`, `share-button.tsx`, `scroll-container.tsx`,
  `user-sync.tsx`, `banned-screen.tsx`, `go-back.tsx`, `default-loader.tsx`,
  `default-not-found.tsx`, `default-empty-state.tsx`.

## 9. Cross-cutting client libraries

- `src/lib/batcher.ts`, generic `RequestBatcher` (debounce / max-wait /
  max-batch-size / dedupe-by-key / flush-on-page-hide) used for watchlist
  membership writes and season-detail fetches.
- `src/lib/realtime-mutations.ts`, per-domain own-mutation counters that let
  `user-sync.tsx` skip redundant refetches for the client's own writes (see
  section 7).
- `src/lib/media-transform.ts`, pure TMDB→UI transforms (genre mapping,
  video splitting, cast/crew mapping, backdrop/poster URL building,
  certifications, runtime formatting).
- `src/lib/media-page.ts`, `buildSharedMediaPageData` shared by movie/TV
  detail pages (title, slug, images, cast, videos).
- `src/lib/canonical-slug-redirect.ts`, `useCanonicalSlugRedirect` hook that
  redirects non-canonical `/{type}/{id}/{slug}` URLs to the canonical one.
- `src/lib/meta-image-tags.ts`, OpenGraph/Twitter meta-tag generator.
- `src/lib/media-dialog-helpers.ts`, dialog state stored in the URL search
  params (video/backdrop/poster).
- `src/lib/search-history.ts`, localStorage-backed search history (max 8).
- `src/lib/recommendation-engine.ts`, client-side TMDB verification of
  AI-suggested titles: `useTmdbData` (direct fetch) + `useTmdbSearchFallback`
  (search with `titlesMatch` normalization).
- `src/constants.ts`, site config, nav items, genre list, image URL prefixes,
  RBAC labels, placeholder image.
- `src/constants/watchlist.ts`, watchlist-specific constants.
- `src/types.d.ts`, Pebbly-specific domain types (`MediaType`,
  `ProgressStatus`, `ReactionStatus`, `AIRecommendation`).
