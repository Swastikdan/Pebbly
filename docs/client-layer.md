# Client layer

The client is a React 19 SPA rendered by TanStack Start (SSR on the Worker,
hydration in the browser). It combines TanStack Query (server data),
Zustand (local/guest state), and a repository pattern that hides whether a
mutation goes to the server or to local storage.

## 1. App shell & bootstrapping

- `src/start.ts`, client start instance. **Key behavior:** every server-fn
  RPC is wrapped with a fresh Clerk session token
  (`Authorization: Bearer <token>`, minted/rotated by the Clerk SDK) and a
  30 s abort timeout. Also installs `createCsrfMiddleware` scoped to server
  fns so cookie-derived sessions can't be abused cross-site.
- `src/router.tsx`, builds the router: `ClerkProvider` wraps the Query
  provider. Sets `defaultStaleTime: 30s`, intent-based preloading, scroll
  restoration, case-sensitive routes, and the default pending / not-found /
  error components. `setupRouterSsrQueryIntegration` wires router loaders to
  the query cache with redirect handling.
- `src/routes/__root.tsx`, the root layout document: meta tags + PWA headers,
  a **blocking theme-init script** (resolves light/dark/system before first
  paint so neither palette ever flashes), `ToastProvider`,
  `NavigationProgressBar`, skip-to-content link, nav bar, footer (with the
  theme picker), mobile bottom nav, `UserSync`, and app CSS. It also
  registers the service worker in prod (in dev it _unregisters_ any stale
  one and purges Cache Storage), binds `/` as a global shortcut that focuses
  search, and mounts TanStack devtools in dev only.
- `src/routeTree.gen.ts`, generated route tree (do not edit).

## 2. Data fetching (TanStack Query)

- `src/lib/query/query-client.ts`, `getContext()` creates a fresh QueryClient
  per render/request with sane defaults (24 h staleTime, 30 min gcTime,
  retry 1, no refetch on window focus). TMDB data is treated as fresh for a
  day to avoid refetch churn, but `gcTime` (how long _unused_ queries stay
  resident) is kept short so visited page payloads are evicted from memory
  instead of accumulating over a session. A fresh client per SSR request
  keeps journal state (see pending-ops) from leaking between requests.
- `src/lib/query/root-provider.tsx`, React context provider for the client.
- `src/lib/query/devtools.ts`, dev-only React Query devtools toggle.
- `src/lib/query/keys.ts`, `queryKeys` factory: namespaced, user-scoped keys
  (`watchlist.*`, `lists.*`, `permissions`, `admin.*`,
  `recommendations.*`, `data.version` for the combined revision poll). The
  TMDB namespace distinguishes full detail payloads (`movieDetails`/
  `tvDetails`) from lean ones (`basicMovieDetails`/`basicTvDetails`) so sub-
  pages and continue-watching cards share cache entries instead of refetching.
  `listsSyncKeys(userId)` returns the three query groups every lists write
  must keep fresh. User-scoping (`?? "anonymous"`) prevents cached data from
  leaking across accounts.
- `src/lib/queries.ts`, TMDB query functions used by routes/components
  (`getMediaList`, `getMovieDetails`, `getTvDetails`, `getBasicMovieDetails`,
  `getCredits`, `getSearchResult`, `getPersonDetails`, ...).
  `MEDIA_LIST_PATHS` is the single source of truth for list endpoints;
  `safeFetch` logs rich errors in dev.
- `src/lib/tmdb.ts`, the `@better-fetch/fetch` client for TMDB: bearer
  token, 15 s timeout, linear retry on 408/429/5xx.
- `src/lib/tmdb-schemas.ts`, Valibot schemas for every TMDB response shape
  (~670 lines). Query functions validate responses against these.
- `src/lib/server-types.ts`, client-side aliases of D1 row types
  (`WatchItemRow`, `EpisodeProgressRow`, `CustomListRow`, ...).
- `src/domain/media.ts`, the dependency-free canonical `MediaType` contract,
  Valibot-independent type guard, and route-slug map. `src/lib/media-types.ts`
  re-exports the compatibility schema and domain helpers for existing callers.

## 3. State management (Zustand → `src/stores/`)

All persisted guest stores live in **`src/stores/`**:

| Store                   | File                                 | Purpose                                                                                                                                                                                                       |
| :---------------------- | :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useWatchlistStore`     | `src/stores/watchlist-store.ts`      | Guest watchlist (`mediaState`), persisted to localStorage with LRU eviction; mutators `setWatchlistMembershipLocal`, `setProgressStatusLocal`, `setReactionLocal`, `setProgressLocal`, `importWatchlistLocal` |
| `useLocalListsStore`    | `src/stores/local-lists-store.ts`    | Guest custom lists                                                                                                                                                                                            |
| `useLocalProgressStore` | `src/stores/local-progress-store.ts` | Guest episode/progress state (`lastPlayed`, watched episodes)                                                                                                                                                 |
| `useDailyPickStore`     | `src/stores/daily-pick-store.ts`     | Bounded persisted per-title backdrop/poster metadata cache; trending/popular catalogs remain in React Query                                                                                                   |

All guest stores share their persist plumbing via
`src/stores/guest-store-kit.ts`: `guestPersistOptions()` and `guardedMerge()`
provide versioned, SSR-safe persistence with optional per-store sanitizers.
Valibot-backed sanitizers discard malformed persisted entries while retaining
valid siblings; primitive/array payloads fall back to fresh state. Small
helpers include `localId` for collision-free local ids, `nextRank` for
append-position, and `mergeDefinedFields` for sparse patches.

Two more stores live beside their feature code:

- `useThemeStore` inside `src/hooks/use-theme.ts`, light/dark/system theme
  preference (persisted separately under `pebbly-theme`).
- Toasts in `src/hooks/use-toast-store.ts`, fire-and-forget `toast()` backed
  by Base UI's toast manager. Call it from anywhere, no provider needed.

- `src/lib/utils.ts`, `createLRUStorage()` wraps localStorage with LRU
  eviction (4 MB threshold, evicting down to 60% of the limit) so several
  persisted stores can't blow the quota; `createMemoryStorage()` is the
  SSR-safe fallback. Also: `cn` (clsx + tailwind-merge),
  `normalizeProgressStatus`, `inferStatusFromProgress` (≥95 → done, >0 → watching; the single home of
  that rule), `validateId` /
  `parseAndValidateId` (strict TMDB id parsing), and `formatMediaTitle`
  (slug encode/decode with diacritic stripping).
- `src/lib/text.ts`, tiny pure string helpers shared by prompts and TMDB
  verification (`normalizeTitleKey`, `hashString`).

## 4. The repository pattern (`src/lib/repository/`)

The mutation layer that eliminated the old `if (isSignedIn)` branches:

- `types.ts`, `WatchlistRepository` + `ListsRepository` interfaces and the
  shared `resolveProgressStatusAction` decision tree (TV vs movie progress
  writes: mark watched, leave completion, episode sync needed, progress value).
- `types.ts` holds `resolveStatusPlan()`, the single decision pipeline both
  adapters run for progress-status writes. It resolves the TV-vs-movie action
  and, when episode rows must follow the new status, kicks off the one TMDB
  season fetch and builds the per-season episode selections. Adapters only
  _execute_ the plan; neither re-implements the semantics.
- `use-repository.ts`, `useRepository()` returns the remote implementation
  when signed in, the local one otherwise (memoized per auth state).
- `remote-repository.ts`, server-backed implementation:
  - watchlist membership writes go through a shared `RequestBatcher`
    (300 ms debounce / 1.2 s max wait / max batch 100 / dedupe by
    `mediaType:tmdbId` / flush on page hide), then `setWatchlistMembership`
    or `batchSetWatchlistMembership`; the authoritative rows are merged into
    the cache with `applyServerState`.
  - progress status / reactions / episode syncs run through
    `runJournaledMutation` (begin op → run fn → resolve/rollback → schedule
    sync) on top of `resolveStatusPlan` for status changes.
  - custom-list CRUD wraps each server fn with optimistic ops + id swapping
    (optimistic temp id → real id via `localId()`) + cache sync; ordered
    lists get a dedicated reorder op builder.
  - Successful server writes call `recordOwnMutation` (see
    `realtime-mutations.ts`) so the realtime poll can tell this client's own
    changes apart from external ones.
- `local-repository.ts`, the same interface against the Zustand stores in
  `src/stores/`. TV progress runs the same `resolveStatusPlan`.

## 5. Optimistic updates (`src/lib/data/pending-ops.ts`)

A replayable journal for array-shaped query caches (watchlist, lists). This
is pure data-layer code under `lib/data/` (no hook imports):

- `beginOp(queryClient, entries)` registers a set of pure `apply(rows)`
  patches and applies them immediately. **Throws during SSR.** Optimistic ops
  are client-only by construction.
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

The rest of the data layer sits beside it:

- `src/lib/data/optimistic/watchlist-optimistic.ts`, membership/progress/
  reaction/mark-show op builders (incl. `buildSeasonEpisodeSelections`) plus
  the shared row transforms (`applyProgressUpdateRows`,
  `applyProgressResetRows`).
- `src/lib/data/optimistic/list-optimistic.ts`, list CRUD op builders
  (`beginCreateListOp`, `beginToggleListItemOp`, `beginReorderListItemsOp`,
  `swapListId`, ...).
- `src/lib/data/watchlist-queries.ts`, TanStack Query fns for watchlist data
  (list, tracked ids, media state, episodes). Every server response passes
  through the journal reconciler before entering the cache. Feature hooks
  consume these instead of calling raw fns, which also guarantees the
  recommendations page's custom-list fetches are journal-reconciled.

## 6. Feature hooks (`src/hooks/`)

- `use-watchlist.ts`, read/mutation hooks for the signed-in watchlist
  (~175 lines; delegates writes to the repository) via
  `lib/data/watchlist-queries.ts`.
- `use-watchlist-import-export.ts`, export/import of watchlists (JSON),
  including the local→remote promotion on sign-in (~440 lines).
- `use-custom-lists.ts`, custom-list reads + mutations (delegates to the
  repository).
- `use-recommendations.ts`, AI recommendation queries/mutations (history,
  generate, feedback). Caps its exclusion list at `MAX_EXCLUDE_TMDB_IDS`
  (= 1000, defined server-side) before sending.
- `use-tmdb-verification.ts`, verifies AI-suggested titles against TMDB:
  `useTmdbData` (direct fetch by id), `useTmdbSearchFallback` (search with
  `titlesMatch` normalization), and `normalizeTmdbData`.
- `use-resolved-recommendation.ts`, the resolution machine used by
  recommendation cards: verify the suggested tmdbId (title match + rating +
  poster), fall back to search; pass `enabled: false` for entries already
  backed by verified cached data.
- `use-daily-pick.ts`, orchestrates "Tonight's Pick": two gated trending/
  popular-TV queries from canonical React Query keys, candidate building, and
  date-seeded stable selection via the pure engine in
  `src/lib/daily-pick-engine.ts`. Only the bounded image-detail metadata cache
  persists locally; detail lookups reuse canonical `movieDetails`/`tvDetails`
  cache entries.
- `use-remove-with-undo.ts`, removes a watchlist item immediately and offers
  an Undo toast that performs the inverse toggle (deliberately distinct from
  `use-destructive-toast`, which defers the mutation until countdown expiry).
- `use-url-paged-query.ts`, URL-driven pagination helper: syncs the `page`
  search param with query state, clamps against `MAX_PAGINATION_LIMIT` (500),
  optional scroll-to-top. Used by the search, list, and keyword pages.
- `use-season-details.ts`, batched TV season-detail fetching (a shared
  `RequestBatcher` so a continue-watching strip of N cards coalesces its TMDB
  requests onto the shared `seasonDetails` cache key).
- `use-filtered-watchlist.ts`, filter/sort state for the watchlist tab.
  Pagination itself is plain local state in `watchlist-tab.tsx`
  (`WATCHLIST_PAGE_SIZE = 30` there).
- `use-permissions.ts`, client-side RBAC summary (roles, features, admin,
  banned) from `getUserFeaturesFn`. **No fixed poll**: it refetches on window
  focus and whenever UserSync observes a `permsRev` delta, so a banned user
  is signed out within one adaptive interval.
- `use-theme.ts`, theme preference + DOM application (see §1); also exports
  `setThemeWithTransition` (View Transitions crossfade) and `toggleTheme`.
- `use-canonical-slug-redirect.ts`, redirects non-canonical
  `/{type}/{id}/{slug}` URLs to the canonical one (moved here from `lib/`
  because it's a genuine hook). Consumed by all detail routes and the shared
  basic-page bodies.
- `use-destructive-toast.ts`, confirmation toast that defers destructive
  actions until a countdown expires unless undone.
- `use-watch-progress` (`src/hooks/watch-progress/`), player progress
  tracking: `use-watch-progress.ts` (~450 lines), `use-player-listener.ts`
  (postMessage listener that trusts sources by origin, with a DOM-scan
  fallback). Pure player/progress contracts and helpers live in
  `src/lib/watch-progress.ts`; the old `progress-helpers.ts` path is a
  compatibility re-export for hook-local callers.
- `data-version.ts`, `fetchDataVersion`, the client fetch for the combined
  per-user revision counters (`watchlistRev`, `listsRev`, `aiRev`,
  `permsRev`).

## 7. Cross-device realtime (`user-sync.tsx` + `realtime-mutations.ts` + `cross-tab-sync.ts`)

Convex's realtime subscriptions are replaced by **version-gated polling**
(see ADR-015):

- `src/lib/realtime-mutations.ts`, per-domain counters (`watchlist` / `lists`
  / `ai`) of this client's **successful** server writes, recorded by the
  repository, the pending-op journal, and the AI/import hooks at every
  rev-bumping call site.
- `user-sync.tsx`, polls `data.version` on an adaptive cadence (4 s fast lane
  within 20 s of own mutations, 10 s during activity (2 min window), 30 s
  when quiet, 60 s after ≥3 poll failures; pauses on hidden tabs) and tracks
  the last-seen revisions per user. When a revision moves **beyond what the
  client's own mutations can explain**, it invalidates the matching query
  group (watchlist list / `listsSyncKeys` / AI history + homepage and
  feedback caches), so mounted queries refetch. Own writes never trigger a
  redundant refetch; external changes always do. Per-poll cost is 1 row read
  regardless of collection size. Any `permsRev` movement invalidates
  permissions (own writes excluded by construction). The same component
  enforces bans (sign-out) and upserts the profile via `storeUser`.
- `src/lib/cross-tab-sync.ts`, BroadcastChannel fan-out (`pebbly-sync`) so
  sibling tabs of the same browser invalidate each other instantly (no server
  round trip).

## 8. Routing & pages (`src/routes/`)

- Static shells with head metadata + search-param validation: `search.tsx`,
  `watchlist.tsx`, `recommendations.tsx`, `admin.tsx`, `disclaimer.tsx`.
- Lazy UI variants: `search.lazy.tsx`, `watchlist.lazy.tsx`,
  `recommendations.lazy.tsx`.
- Discovery pages: `index.tsx` (homepage with trending rows, daily pick, AI
  picks), `list.$type.$slug.tsx` (popular/top-rated/... lists with URL
  pagination), `person.$id.tsx`, `keyword.$id.tsx`,
  `collection.$id.{-$slug}.tsx` (**TMDB franchise** collections).
- Shared collections: `c.$id.{-$slug}.tsx`, the public page for a
  **user-created list**. The loader fetches `getCollectionPage` (owner vs
  visitor resolved server-side; private/missing → 404) and renders the
  `CollectionPage` component.
- Detail pages: `movie/$id/{-$slug}/` and `tv/$id/{-$slug}/` are twin trees
  (`index`, `media`, `cast-crew`; tv adds `seasons` +
  `season.$seasonNumber`). Every route keeps a literal `createFileRoute(...)`
  call and takes everything else from the factories in
  `src/lib/media-route-options.ts`; loaders/head share
  `src/lib/route-helpers.ts`. All pages use `useCanonicalSlugRedirect` to
  normalize `/{id}/{slug}` URLs.
- `api.metaimage.ts`, OG-image redirect endpoint: resolves a title to its
  TMDB poster/backdrop and 302-redirects to a cached image URL (with
  placeholder fallback).

## 9. Components (`src/components/`)

The UI kit is **coss ui on Base UI** (`@base-ui/react`). The roles match the
old shadcn/Radix set; the foundation doesn't.

- `ui/` primitives: `button`, `badge`, `dialog`, `menu`, `select`, `sheet`,
  `tabs`, `accordion`, `input`, `label`, `skeleton`, `spinner`, `pagination`,
  `empty`, `feedback`, `toast` (the `ToastProvider` + manager), plus
  app-specific primitives: `image.tsx`, `media-grid.tsx`, `lazy-section.tsx`,
  `auto-scroll-title.tsx`, `search-bar.tsx` (debounced URL-navigation search
  input with history), `icons.tsx` (hand-rolled lucide-compatible SVG set).
- `media/`, detail-page blocks: **`media-detail-page.tsx`** (the shared index
  layout with `aboveMedia`/`belowMedia` slots), **`basic-media-pages.tsx`**
  (`MediaGalleryPage` + `MediaCreditsPage` shared by four subroutes),
  **`media-thumb-rail.tsx`** (generic deep-linking thumbnail rail),
  `media-container.tsx` (layout), `media-title-container.tsx`,
  `media-video-image-container.tsx`, `media-poster-trailer-container.tsx`,
  `watchlist-status-menu.tsx`, `cast-section.tsx`,
  `media-credit-section.tsx`, `inline-episode-browser.tsx`, `collections.tsx`,
  `genre-container.tsx`, `media-keywords.tsx`, `media-lightbox-dialog.tsx`,
  `rating-count.tsx`, `media-description.tsx`, `media-recommendation.tsx`.
- `watchlist/`: **`watchlist-tab.tsx`** (filters + 30-per-page paginated grid
  - import/export) and **`my-lists-tab.tsx`** (custom lists + create flow),
    the two tabs the watchlist route composes; `watchlist-grid.tsx`,
    `watchlist-card.tsx`, `watchlist-filters.tsx`,
    **`media-row-card-shell.tsx`** (shared row-card chrome + static pills used
    by both watchlist and collection cards), `list-collage.tsx`,
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
  every 10 s while the admin page is open. The page is admin-gated client-
  and server-side, so non-admins never fetch it).
- Top-level widgets: `paged-media-grid.tsx` (paginated grid wrapper used by
  the list + keyword routes), `media-skeleton-list.tsx` (loading rail;
  deliberately not under `ui/`), `navbar.tsx`, `footer.tsx` +
  `footer-theme-select.tsx` (light/dark/system picker),
  `mobile-bottom-nav.tsx`, `desktop-nav-button.tsx`,
  `navigation-progress-bar.tsx` (top loading bar), `media-card.tsx`,
  `homepage-media.tsx`, `homepage-recommendations.tsx` ("Picks For You" row +
  feedback), `daily-pick.tsx` (theme-aware backdrop placeholder when no image
  exists), `video-player-modal.tsx`, `watchlist-button.tsx`,
  `custom-list-dialog.tsx`, `share-button.tsx`, `scroll-container.tsx`,
  `user-sync.tsx` (session sync, cross-device realtime, ban enforcement),
  `go-back.tsx`, `default-loader.tsx`, `default-not-found.tsx` (error +
  not-found), `default-empty-state.tsx`.

## 10. Cross-cutting client libraries

- `src/lib/batcher.ts`, generic `RequestBatcher` (debounce / max-wait /
  max-batch-size / dedupe-by-key / flush-on-page-hide) used for watchlist
  membership writes and season-detail fetches.
- `src/lib/media-transform.ts`, pure TMDB→UI transforms (genre mapping,
  video splitting, cast/crew mapping, backdrop/poster URL building,
  certifications, runtime formatting).
- `src/lib/media-page.ts`, `buildSharedMediaPageData` feeding the shared
  movie/TV detail-page body (title, slug, images, cast, videos).
- `src/lib/route-helpers.ts` + `src/lib/media-route-options.ts`, the shared
  loader/head ceremony and option factories behind every movie/tv twin route
  (see §8 and [architecture.md](./architecture.md#31-routing--app-shell)).
- `src/lib/meta-image-tags.ts`, OpenGraph/Twitter meta-tag generator.
- `src/lib/media-dialog-helpers.ts`, dialog state stored in the URL search
  params (video/backdrop/poster).
- `src/lib/search-history.ts`, localStorage-backed search history (max 8).
- `src/lib/daily-pick-engine.ts`, pure "Tonight's Pick" selection engine
  (seeded by date, interleaves movies/TV, scores candidates) consumed by
  `use-daily-pick.ts`.
- `src/lib/segmented-control.ts`, shared styles/state helpers for segmented
  filter controls.
- `src/constants.ts`, site config, nav items, genre list, `IMAGE_PREFIX`
  (TMDB image size URLs), `MAX_PAGINATION_LIMIT`, RBAC labels, placeholder
  image.
- `src/constants/watchlist.ts`, watchlist-specific constants.
- `src/domain/`, dependency-free shared contracts for media identity,
  watchlist statuses/metadata, recommendations, notifications, and pure
  object helpers.
- `src/domain/media-query.ts`, dependency-free `MediaQuery` and
  `MediaListQuery` contracts used by TMDB queries and list routes.
- `src/types.d.ts`, compatibility type re-exports for legacy consumers.
