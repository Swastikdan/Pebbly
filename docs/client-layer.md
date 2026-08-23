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
- `src/router.tsx`, builds the router: `ClerkProvider` wraps the Query
  provider. Sets `defaultStaleTime: 30s`, intent-based preloading, scroll
  restoration, case-sensitive routes, and the default pending / not-found /
  error components. `setupRouterSsrQueryIntegration` wires router loaders to
  the query cache with redirect handling.
- `src/routes/__root.tsx`, the root layout document (`shellComponent`):
  meta tags + PWA headers, a **blocking theme-init script** (resolves
  light/dark/system before first paint so neither palette ever flashes),
  `ToastProvider`, `NavigationProgressBar`, skip-to-content link, nav bar,
  footer (with the theme picker), mobile bottom nav, `UserSync`, and app CSS.
  It also registers the service worker in prod (and _unregisters_ any stale
  one in dev), binds `/` as a global shortcut that focuses search, and mounts
  TanStack devtools in dev only.
- `src/routeTree.gen.ts`, generated route tree (do not edit).

## 2. Data fetching (TanStack Query)

- `src/lib/query/query-client.ts`, `getContext()` creates a fresh QueryClient
  per render/request with sane defaults (24 h staleTime, 30 min gcTime, retry 1,
  no refetch on window focus). TMDB data is treated as fresh for a day to avoid
  refetch churn, but `gcTime` (how long _unused_ queries stay resident) is kept
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
  (~714 lines). Query functions validate responses against these.
- `src/lib/server-types.ts`, client-side aliases of D1 row types
  (`WatchItemRow`, `EpisodeProgressRow`, `CustomListRow`, ...).
- `src/lib/media-types.ts`, the canonical `MediaType` module: the
  `"movie" | "tv"` union, its Valibot schema, a type guard, and route-slug
  mappings. Everything else imports from here instead of redefining the union.

## 3. State management (Zustand)

| Store                   | File                                    | Purpose                                                                                                                                                                                                       |
| :---------------------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useWatchlistStore`     | `src/hooks/watchlist-store.ts`          | Guest watchlist (`mediaState`), persisted to localStorage with LRU eviction; mutators `setWatchlistMembershipLocal`, `setProgressStatusLocal`, `setReactionLocal`, `setProgressLocal`, `importWatchlistLocal` |
| `useLocalListsStore`    | `src/hooks/use-local-lists-store.ts`    | Guest custom lists                                                                                                                                                                                            |
| `useLocalProgressStore` | `src/hooks/use-local-progress-store.ts` | Guest episode/progress state (`lastPlayed`, watched episodes)                                                                                                                                                 |
| `useDailyPickStore`     | `src/hooks/use-daily-pick-store.ts`     | Daily-pick seed/date bookkeeping                                                                                                                                                                              |
| `useThemeStore`         | `src/hooks/use-theme.ts`                | Light/dark/system theme preference (persisted separately in localStorage under `pebbly-theme`)                                                                                                                |
| Toasts                  | `src/hooks/use-toast-store.ts`          | Fire-and-forget `toast()` backed by Base UI's toast manager — call it from anywhere, no provider needed                                                                                                       |

All guest stores share their persist plumbing via `src/hooks/guest-store-kit.ts`:
`guestPersistOptions()` (LRU-capped storage on the client, plain memory during
SSR), plus small helpers (`localId` for collision-free local ids, `nextRank`
for append-position, `mergeDefinedFields` for sparse patches).

- `src/lib/utils.ts`, `createLRUStorage()` wraps localStorage with LRU
  eviction (~4 MB threshold) so several persisted stores can't blow the quota;
  `createMemoryStorage()` is the SSR-safe fallback. Also: `cn` (clsx +
  tailwind-merge), `normalizeProgressStatus`, `validateId` /
  `parseAndValidateId` (strict TMDB id parsing), and `formatMediaTitle`
  (slug encode/decode with diacritic stripping).
- `src/lib/text.ts`, tiny pure string helpers shared by prompts and the
  recommendation engine (`normalizeTitleKey`, `hashString`).

## 4. The repository pattern (`src/lib/repository/`)

The mutation layer that eliminated the old `if (isSignedIn)` branches:

- `types.ts`, `WatchlistRepository` + `ListsRepository` interfaces and the
  shared `resolveProgressStatusAction` decision tree (TV vs movie progress
  writes: mark watched, leave completion, episode sync needed, progress value).
- `status-plan.ts`, `resolveStatusPlan()` — the single decision pipeline both
  adapters run for progress-status writes. It resolves the TV-vs-movie action
  and, when episode rows must follow the new status, kicks off the one TMDB
  season fetch and builds the per-season episode selections. Adapters only
  _execute_ the plan; neither re-implements the semantics.
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
    sync) on top of `resolveStatusPlan` for status changes.
  - custom-list CRUD wraps each server fn with optimistic ops + id swapping
    (optimistic temp id → real id via `localId()`) + cache sync; ordered
    lists get a dedicated reorder op builder.
  - Successful server writes call `recordOwnMutation` (see
    `realtime-mutations.ts`) so the realtime poll can tell this client's own
    changes apart from external ones.
- `local-repository.ts`, the same interface against the Zustand stores
  (watchlist store + local lists/progress stores). TV progress runs the same
  `resolveStatusPlan`.

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
  _replaying still-pending ops on top_, so a snapshot computed before a write
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
  mark-show op builders (incl. `buildSeasonEpisodeSelections`).
- `src/hooks/custom-lists/list-optimistic.ts`, list CRUD op builders
  (`beginCreateListOp`, `beginToggleListItemOp`, `beginReorderListItemsOp`,
  `swapListId`, ...).

## 6. Feature hooks

- `use-watchlist.ts`, read/mutation hooks for the signed-in watchlist
  (~174 lines; delegates writes to the repository) via `watchlist-queries.ts`.
- `use-watchlist-import-export.ts`, export/import of watchlists (JSON),
  including the local→remote promotion on sign-in.
- `use-custom-lists.ts`, custom-list reads + mutations (delegates to the
  repository).
- `use-recommendations.ts`, AI recommendation queries/mutations (history,
  generate, feedback, verified resolution). The recommendations page caps its
  exclusion list at `MAX_EXCLUDE_TMDB_IDS` before sending.
- `use-daily-pick.ts`, thin hook over the pure selection engine in
  `src/lib/daily-pick-engine.ts` (seeded randomness, media interleaving,
  scoring — no React, clocks, or network inside the engine itself).
- `use-season-details.ts`, batched TV season-detail fetching (a shared
  `RequestBatcher` so a continue-watching strip of N cards coalesces its TMDB
  requests).
- `use-filtered-watchlist.ts`, filter/sort state for the watchlist page. The
  watchlist grid renders 30 items per page (`WATCHLIST_PAGE_SIZE` in
  `watchlist.lazy.tsx`).
- `use-permissions.ts`, client-side RBAC summary (roles, features, admin,
  banned) from `getUserFeaturesFn`. **No fixed poll anymore**: it refetches on
  window focus and whenever UserSync observes a `permsRev` delta, so a banned
  user is signed out within one adaptive interval instead of up to 30 s.
- `use-theme.ts`, theme preference + DOM application (see §1); also exports
  `setThemeWithTransition` (View Transitions crossfade) and `toggleTheme`.
- `use-media-query.ts` / `useIsMobile`, SSR-safe responsive breakpoints.
- `use-destructive-toast.ts`, shared confirmation toast helper for
  destructive actions (delete list, remove item, ...).
- `use-watch-progress` (`src/hooks/watch-progress/`), player progress
  tracking: `use-watch-progress.ts` (~465 lines), `use-player-listener.ts`
  (postMessage listener that trusts sources by origin, with a DOM-scan
  fallback), `progress-helpers.ts` (pure progress math + types incl.
  `buildPlayerUrl`).

## 7. Cross-device realtime (`src/hooks/data-version.ts` + `src/lib/realtime-mutations.ts`)

Convex's realtime subscriptions are replaced by **version-gated polling**
(see ADR-015):

- `src/lib/realtime-mutations.ts`, per-domain counters (`watchlist` / `lists`
  / `ai` / permissions) of this client's **successful** server writes,
  recorded by the repository and the mutation hooks at every rev-bumping call
  site.
- `src/hooks/data-version.ts`, `fetchDataVersion`, the client fetch for the
  combined per-user revision counters (`watchlistRev`, `listsRev`, `aiRev`,
  `permsRev`).
- `user-sync.tsx`, polls `data.version` on an adaptive cadence (4 s fast lane
  right after own mutations, 10 s during activity, 30 s when quiet, 60 s
  backoff on failures; pauses on hidden tabs) and tracks the last-seen
  revisions per user. When a revision moves **beyond what the client's own
  mutations can explain**, it invalidates the matching query group (watchlist
  list / lists / AI history + homepage and feedback caches), so mounted
  queries refetch. Own writes never trigger a redundant refetch; external
  changes always do. Per-poll cost is 1 row read regardless of collection
  size. The same component enforces bans: a banned signed-in user is signed
  out (there is no separate banned screen anymore).

## 8. Routing & pages (`src/routes/`)

- Static shells with head metadata + search-param validation: `search.tsx`,
  `watchlist.tsx`, `recommendations.tsx`, `admin.tsx`, `disclaimer.tsx`.
- Lazy UI variants: `search.lazy.tsx`, `watchlist.lazy.tsx`,
  `recommendations.lazy.tsx`.
- Discovery pages: `index.tsx` (homepage with trending rows, daily pick, AI
  picks), `list.$type.$slug.tsx` (popular/top-rated/... lists with
  pagination), `person.$id.tsx`, `keyword.$id.tsx`,
  `collection.$id.{-$slug}.tsx` (**TMDB franchise** collections).
- Shared collections: `c.$id.{-$slug}.tsx`, the public page for a
  **user-created list** — loader fetches `getCollectionPage` (owner vs
  visitor resolved server-side; private/missing → 404) and renders the
  `CollectionPage` component.
- Detail pages: `movie/$id/{-$slug}/index.tsx` (+ `media.tsx`,
  `cast-crew.tsx`) and `tv/$id/{-$slug}/index.tsx` (+ `seasons.tsx`,
  `season.$seasonNumber.tsx`, `media.tsx`, `cast-crew.tsx`). All use
  `useCanonicalSlugRedirect` to normalize `/{id}/{slug}` URLs.
- `api.metaimage.ts`, OG-image redirect endpoint: resolves a title to its
  TMDB poster/backdrop and 302-redirects to a cached image URL (with
  placeholder fallback).

## 9. Components (`src/components/`)

The UI kit is **coss ui on Base UI** (`@base-ui/react`) — the roles match the
old shadcn/Radix set, the foundation doesn't.

- `ui/` (~24 primitives): `button`, `badge`, `dialog`, `menu`, `select`,
  `sheet`, `tabs`, `accordion`, `input`, `label`, `skeleton`, `spinner`,
  `scroll-area`, `pagination`, `empty`, `feedback`, `toast` (the
  `ToastProvider` + manager), plus app-specific primitives: `image.tsx`,
  `media-grid.tsx`, `media-skeleton-list.tsx`, `lazy-section.tsx`,
  `auto-scroll-title.tsx`, `search-bar.tsx`, `icons.tsx` (lucide icon set).
- `media/`, detail-page blocks: `media-container.tsx` (layout),
  `media-title-container.tsx`, `media-video-image-container.tsx`,
  `media-poster-trailer-container.tsx`, `watchlist-status-menu.tsx`,
  `cast-section.tsx`, `media-credit-section.tsx`,
  `inline-episode-browser.tsx`, `collections.tsx`, `genre-container.tsx`,
  `media-keywords.tsx`, `media-lightbox-dialog.tsx`, `rating-count.tsx`,
  `media-description.tsx`, `media-recommendation.tsx`.
- `watchlist/`: `watchlist-grid.tsx` (30-per-page pagination),
  `watchlist-card.tsx`, `watchlist-filters.tsx`, `list-collage.tsx`,
  `collection-page.tsx` (public `/c/$id` view: edit/reorder/clone for the
  owner, sanitized read-only view for visitors), `custom-list-card.tsx`,
  `custom-list-media-card.tsx`, `silent-error-boundary.tsx`.
- `recommendations/`: `recommendation-filters.tsx` (filters + era presets),
  `recommendation-results.tsx`, `recommendation-history.tsx`,
  `recommendation-utils.ts`.
- `admin/`, a tabbed dashboard (Users / Permissions):
  `admin-dashboard.tsx`, `admin-user-table.tsx` (orchestrator),
  `admin-user-row.tsx`, `admin-role-dialog.tsx`,
  `admin-permission-toggles.tsx`, `use-admin-users.ts` (data hook; polls
  every 10 s while the admin page is open — the page is admin-gated client-
  and server-side, so non-admins never fetch it).
- Top-level widgets: `navbar.tsx`, `footer.tsx` + `footer-theme-select.tsx`
  (light/dark/system picker), `mobile-bottom-nav.tsx`,
  `desktop-nav-button.tsx`, `navigation-progress-bar.tsx` (top loading bar),
  `media-card.tsx`, `homepage-media.tsx`, `homepage-recommendations.tsx`
  ("Picks For You" row + feedback), `daily-pick.tsx`,
  `video-player-modal.tsx`, `watchlist-button.tsx`,
  `custom-list-dialog.tsx`, `share-button.tsx`, `scroll-container.tsx`,
  `user-sync.tsx` (session sync, cross-device realtime, ban enforcement),
  `go-back.tsx`, `default-loader.tsx`, `default-not-found.tsx` (error +
  not-found), `default-empty-state.tsx`.

## 10. Cross-cutting client libraries

- `src/lib/batcher.ts`, generic `RequestBatcher` (debounce / max-wait /
  max-batch-size / dedupe-by-key / flush-on-page-hide) used for watchlist
  membership writes and season-detail fetches.
- `src/lib/cross-tab-sync.ts`, BroadcastChannel fan-out so sibling tabs of
  the same browser invalidate each other instantly (no server round trip).
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
  (search with `titlesMatch` normalization from `src/lib/text.ts`).
- `src/lib/daily-pick-engine.ts`, pure "Tonight's Pick" selection engine
  (seeded by date, interleaves movies/TV, scores candidates) consumed by
  `use-daily-pick.ts`.
- `src/lib/segmented-control.ts`, shared styles/state helpers for segmented
  filter controls.
- `src/constants.ts`, site config, nav items, genre list, image URL prefixes,
  RBAC labels, placeholder image.
- `src/constants/watchlist.ts`, watchlist-specific constants.
- `src/types.d.ts`, Pebbly-specific domain types (`MediaType`,
  `ProgressStatus`, `ReactionStatus`, `AIRecommendation`).
