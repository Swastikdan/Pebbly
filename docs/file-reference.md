# File Reference

A per-file map of the repository: what each file is and why it exists. Line
counts are approximate (as of 2026-08-16). Entries are grouped by directory.

---

## Root configuration

| File | What it is |
| :--- | :--- |
| `package.json` | App metadata + scripts (`dev`, `build`, `db:*`, `deploy:cf`, `typecheck`, `lint`, `format`), deps (TanStack Start/Router/Query, React 19, Drizzle, Valibot, Clerk, h3, Nitro, Tailwind 4, Zustand, better-fetch, lucide) and dev deps (Vite 7, Wrangler, Biome, drizzle-kit, husky, lint-staged). `packageManager: pnpm@10.6.1`. |
| `pnpm-workspace.yaml` | Empty workspace config; declares dependency trust policies (allowlist of packages that may run install scripts, e.g. `esbuild`, `@clerk/shared`) and `minimumReleaseAge`. |
| `pnpm-lock.yaml` | Lockfile for reproducible installs. |
| `tsconfig.json` | Strict TS config (`strict`, `noUnusedLocals/Parameters`), bundler module resolution, `@/*` → `./src/*` path alias, `noEmit` (Vite builds). |
| `vite.config.ts` | Vite build: Nitro plugin, TanStack Start plugin, React plugin with the React Compiler Babel plugin, Tailwind v4, path aliases. Terser minification with `drop_console` in prod, manual vendor chunking (react, tanstack, clerk, radix, icons), `envPrefix: ["VITE_"]` (only `VITE_*` vars reach the client). |
| `nitro.config.ts` | Nitro server config: scans `server/`, enables the task system, maps cron `0 3 * * *` → task `snapshots`, adds cache-control (assets) + security headers, and switches to the `cloudflare_module` preset in production. |
| `wrangler.toml` | Cloudflare Worker definition: name `pebbly`, entry `.output/server/index.mjs`, `nodejs_compat` flag, `ASSETS` binding for static files, `DB` D1 binding (+migrations dir), cron trigger `[triggers] crons = ["0 3 * * *"]`, observability (logs + traces). |
| `drizzle.config.ts` | Drizzle Kit *generate-only* config: SQLite dialect, schema `src/server/db/schema.ts`, output `drizzle/`. No driver needed (migrations are applied by wrangler). |
| `drizzle.studio.config.ts` | Drizzle Studio dashboard config for the **remote** D1 DB via `d1-http` (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`). Parses the `database_id` out of `wrangler.toml` (top-level only, so `[env.*]` blocks can't shadow it). |
| `biome.json` | Biome lint/format config: tabs, double quotes, organize-imports assist; `routeTree.gen.ts` and `styles.css` excluded; a11y `noSvgWithoutTitle` off. |
| `postcss.config.ts` | PostCSS config for Tailwind v4. |
| `components.json` | shadcn/ui component registry config. |
| `.prettierrc` | Prettier fallback config (Biome is the primary formatter). |
| `.env.example` | Documented env template: Clerk, TMDB, Gemini, Cloudflare vars. |
| `.env` / `.env.local` / `.dev.vars` | Local secrets (gitignored); `.dev.vars` feeds `wrangler dev`. |
| `.gitignore` | Ignored paths (node_modules, .output, .wrangler, .vercel, env files, etc.). |
| `.husky/pre-commit` | Husky git hook running `lint-staged` (Biome check on staged files). |
| `README.md` | Project readme: features, stack, setup, scripts, deployment. |
| `REFACTOR_PLAN.md` | The Convex→D1 refactoring plan with issue catalog, phased execution plan, and progress log (valuable historical context). |
| `.cta.json`, `.commandcode/`, `.agents/` | Local agent/tooling metadata (not part of the app). |

## `server/` — Nitro layer (framework-agnostic entry points)

| File | What it is |
| :--- | :--- |
| `routes/api/health.ts` | `GET /api/health` — pings D1 (`select 1`), returns `{ ok, service, timestamp, checks, durationMs }`; `503` when the DB is unavailable; never leaks raw DB errors (public endpoint). Skips the DB check when there's no binding (plain `vite dev`). |
| `tasks/snapshots.ts` | Nitro task `snapshots` run by the `0 3 * * *` cron. Reads/persists the `watchlist_snapshot_cursor`, calls `createDailySnapshots` (≤200 users/run), returns a run summary. |

## `drizzle/` — SQL migrations

| File | What it is |
| :--- | :--- |
| `0000_dear_warbound.sql` | Initial schema: all 10 tables + indexes + check constraints (`users` still had `is_admin`). |
| `0001_slippery_cammi.sql` | Table rebuilds: `role_permissions` gains a real composite PK; `list_items.rating` / `watch_items.rating` become `real`. |
| `0002_cute_bloodstrike.sql` | Adds `snapshot_cursors`. |
| `0003_petite_sugar_man.sql` | Drops `users.is_admin` (admin now resolved from Clerk only). |
| `meta/` | Drizzle Kit journal metadata (which migrations are applied). |

## `.github/workflows/` — CI/CD

| File | What it is |
| :--- | :--- |
| `deploy.yml` | Deploy to Cloudflare on push to `cloudflare` / `feat/convex-to-traditional-backend` or manual dispatch. Steps: checkout → pnpm setup → Node 22 → `pnpm install --frozen-lockfile` → `pnpm typecheck` → D1 migrations (prod) → `pnpm build` with `VITE_*` secrets → `wrangler deploy`. `concurrency` serializes prod jobs. All actions pinned to node24 runtimes (checkout v7, setup-node v7, pnpm/action-setup v6, wrangler-action v4) — see ADR-014. |

## `src/` — application root

| File | What it is |
| :--- | :--- |
| `start.ts` | Client `createStart` instance: custom `serverFns.fetch` attaches a fresh Clerk Bearer token + 30 s abort timeout; `createCsrfMiddleware` protects server-fn RPCs from cross-site abuse. |
| `router.tsx` | `getRouter()` builds the TanStack Router: routeTree, ClerkProvider (shadcn theme) + QueryProvider wrappers, SSR↔query integration, defaults (staleTime 30 s, pending/not-found/error components, scroll restoration). |
| `routeTree.gen.ts` | **Generated** route tree (TanStack router plugin). Do not edit. |
| `styles.css` | Tailwind v4 global styles + design tokens. |
| `types.d.ts` | Pebbly domain types: `MediaType`, `MediaQuery`/`MediaListQuery`, `ProgressStatus`, `ReactionStatus`, `AIRecommendation`. |
| `constants.ts` | `SITE_CONFIG` (name, URL, nav), `MEDIA_PAGE_SLUGS`, `GENRE_LIST`, `IMAGE_PREFIX` (TMDB image size URLs), `MAX_PAGINATION_LIMIT`, RBAC labels, placeholder image. |
| `constants/watchlist.ts` | Watchlist-specific constants. |

## `src/server/` — backend

| File | What it is |
| :--- | :--- |
| `env.ts` | Worker env access: `getEnv()` reads `globalThis.__env__` (Nitro) with `process.env` fallback; `validateEnv()` (once per isolate) validates string vars with Valibot and logs actionable warnings (loud for missing `CLERK_SECRET_KEY`). |
| `auth.ts` | Clerk session handling: `getSessionToken` (Bearer → cookie), `getSessionClaims` (JWT verify), `requireUser` (resolve-or-create user, race-safe, consolidates duplicates), `getCurrentUser`, `findUserByClaims` (multi-format tokenIdentifier + 15 s cache), admin helpers (`isAdminFromClerkApi`, `getClerkAdminIds`). |
| `rbac.ts` | Feature-flag RBAC: `hasFeature`, `getUserFeatures`, `syncRolePermissions`; admin short-circuits from Clerk (never a stored flag); `global` kill switch + per-role permission rows + `DEFAULT_PERMISSIONS`. |
| `ai.ts` | `callGeminiAI` — Gemini REST client: model fallback chain, per-attempt timeout, per-element Valibot validation, high-demand/503 detection, retries. |
| `db/client.ts` | `getDb(env)` — cached Drizzle D1 instance per binding (WeakMap), fail-fast on a missing `DB` binding, `runBatch` for bounded transactional batches. |
| `db/schema.ts` | The Drizzle schema for all 10 tables (see [data-model.md](./data-model.md)). |
| `helpers/watch-item.ts` | Shared watch-item logic: `getWatchItem`, `normalizeProgressStatus`/`normalizeReaction`, `buildMetadataPatch` (rating clamped 0–10), `upsertWatchItem` (race-safe upsert on `(user, tmdb, mediaType)`). |
| `helpers/snapshots.ts` | `createWatchlistSnapshot` (dedupe against latest) and `createDailySnapshots` (keyset-paginated, bounded per run). |
| `fns/watchlist.ts` | Watchlist + episode server fns (see [server-layer.md](./server-layer.md#6-server-functions-srcserverfns)). |
| `fns/lists.ts` | Custom-list CRUD + item toggling + enriched reads. |
| `fns/import-export.ts` | Bulk watchlist import with bounded D1 batches. |
| `fns/recommendations.ts` | AI generation, homepage picks, history, feedback, cooldown/rate limiting. |
| `fns/admin.ts` | Admin-only user/role/permission management. |
| `fns/users.ts` | `storeUser` upsert + `getStatus`. |
| `schema/common.ts` | Shared enums (`mediaType`, `progressStatus`, `reaction`, `feedback`), `metadataSchema`, the `ApiResult` contract, `ok`/`fail`, `ApiError`, `unwrap`. |
| `schema/watchlist.ts` | Valibot schemas for every watchlist server-fn argument. |
| `schema/lists.ts` | Valibot schemas for list server fns. |
| `schema/recommendations.ts` | Valibot schemas for recommendation server fns + result shapes. |
| `schema/admin.ts` | Valibot schemas for admin server fns. |
| `schema/import.ts` | Valibot schema for watchlist import payloads. |

## `src/lib/` — client/shared utilities

| File | What it is |
| :--- | :--- |
| `tmdb.ts` | `tmdbFetch` — `@better-fetch/fetch` client for TMDB (Bearer token, 15 s timeout, linear retry on 408/429/5xx). |
| `tmdb-schemas.ts` | Valibot schemas for every TMDB response shape (742 lines). |
| `queries.ts` | Typed TMDB query functions (`getMediaList`, `getMovieDetails`, `getTvDetails`, `getCredits`, `getSearchResult`, `getPersonDetails`, ...) with `MEDIA_LIST_PATHS` as the endpoint map and dev-only error logging. |
| `batcher.ts` | Generic `RequestBatcher`: debounce/max-wait/max-batch-size/dedupe-by-key, optional flush-on-page-hide + dispose. |
| `utils.ts` | `cn`, `normalizeProgressStatus`, `createLRUStorage`/`createMemoryStorage` (localStorage quota management), `validateId`/`parseAndValidateId`, `formatMediaTitle` (slug encode/decode). |
| `media-transform.ts` | Pure TMDB→UI transforms: genre lookup, video split, cast/crew, backdrops/posters with size prefixes, certifications, runtime. |
| `media-page.ts` | `buildSharedMediaPageData` — shared data shape for movie/TV detail pages. |
| `media-dialog-helpers.ts` | Dialog state stored in URL search params (video/backdrop/poster lightbox). |
| `canonical-slug-redirect.ts` | `useCanonicalSlugRedirect` — 301-style client redirect to the canonical `/{type}/{id}/{slug}` URL. |
| `meta-image-tags.ts` | `MetaImageTagsGenerator` — OpenGraph/Twitter meta tags. |
| `search-history.ts` | localStorage search history (max 8 items). |
| `server-types.ts` | Client-side aliases of D1 row types. |
| `recommendation-engine.ts` | Client-side TMDB verification of AI titles: `normalizeTmdbData`, `titlesMatch`, `useTmdbData`, `useTmdbSearchFallback`. |
| `repository/types.ts` | `WatchlistRepository` + `ListsRepository` interfaces + `resolveProgressStatusAction`. |
| `repository/remote-repository.ts` | Server-backed repository: optimistic journal + membership batcher + journaled mutations + list ops with id swapping. |
| `repository/local-repository.ts` | Zustand-backed repository for signed-out users. |
| `repository/use-repository.ts` | `useRepository()` — picks remote vs local by auth state. |
| `prompts/index.ts` | Pure Gemini prompt builders (`buildWatchlistPrompt`, `buildGenrePrompt`, `buildCustomListPrompt`, `buildHomepageRecommendationsPrompt`) + shared context/feedback helpers. Dependency-free. |
| `query/query-client.ts` | `getContext()` — fresh QueryClient per render/request with 24 h defaults. |
| `query/root-provider.tsx` | React context provider for the QueryClient. |
| `query/devtools.ts` | Dev-only React Query devtools. |
| `query/keys.ts` | `queryKeys` — centralized, user-scoped query-key factory. |

## `src/hooks/` — React hooks & state

| File | What it is |
| :--- | :--- |
| `watchlist-store.ts` | Zustand guest watchlist store (persisted, LRU storage): `setWatchlistMembershipLocal`, `setProgressStatusLocal`, `setReactionLocal`, `setProgressLocal`, `importWatchlistLocal`. |
| `pending-ops.ts` | The optimistic journal: `beginOp`, `reconcileListFetch`, `applyServerState`, `scheduleSync`, `clearPendingOps`. Client-only; scoped per QueryClient. |
| `optimistic-helpers.ts` | Small shared helpers for optimistic cache patches. |
| `watchlist-queries.ts` | TanStack Query hooks for watchlist data (list, tracked ids, media state, episodes). |
| `use-watchlist.ts` | Thin read/mutation hook delegating to the repository (239 lines after refactor). |
| `watchlist/watchlist-optimistic.ts` | Pure optimistic op builders for watchlist mutations. |
| `custom-lists/list-optimistic.ts` | Pure optimistic op builders for custom-list CRUD. |
| `use-custom-lists.ts` | Custom-list hook (232 lines after refactor; delegates to the repository). |
| `use-local-lists-store.ts` | Zustand guest custom-lists store (persisted). |
| `use-local-progress-store.ts` | Zustand guest progress store (persisted; includes `lastPlayed` and per-episode watched state). |
| `watch-progress/use-watch-progress.ts` | Watch/player progress orchestration (677 lines): data fetching, progress calculations, mutations. |
| `watch-progress/use-player-listener.ts` | postMessage listener for player progress (origin-verified, DOM-scan fallback). |
| `watch-progress/progress-helpers.ts` | Pure progress math + types. |
| `use-watchlist-import-export.ts` | Watchlist export/import (JSON) including guest→remote promotion. |
| `use-recommendations.ts` | AI recommendation queries/mutations (history, generate, feedback, verified resolution). |
| `use-daily-pick.ts` | Daily-pick selection logic (seed generation, interleaving, scoring) — extracted from the component. |
| `use-daily-pick-store.ts` | Zustand daily-pick bookkeeping store. |
| `use-filtered-watchlist.ts` | Filter/sort logic for the watchlist page. |
| `use-permissions.ts` | Client RBAC summary from `getUserFeaturesFn`. |
| `use-season-details.ts` | Batched TV season-detail fetching via a shared `RequestBatcher` (fixes the N+1 in media cards). |
| `use-toast-store.ts` | Toast notification store. |

## `src/components/` — UI

### `ui/` — primitives
`button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `dialog.tsx`,
`sheet.tsx`, `dropdown-menu.tsx`, `select.tsx`, `tabs.tsx`, `accordion.tsx`,
`navigation-menu.tsx`, `hover-card.tsx`, `aspect-ratio.tsx`, `skeleton.tsx`,
`spinner.tsx`, `image.tsx`, `toaster.tsx`, `empty.tsx`, `pagination.tsx`,
`media-grid.tsx`, `media-skeleton-list.tsx`, `lazy-section.tsx`,
`auto-scroll-title.tsx`, `search-bar.tsx`, `icons.tsx` (lucide icon set) —
shadcn-style, Radix-based primitives used across the app.

### `media/` — detail-page blocks
`media-container.tsx` (page layout), `media-title-container.tsx`,
`media-video-image-container.tsx`, `media-poster-trailer-container.tsx`,
`watchlist-status-menu.tsx`, `reaction-selector.tsx`, `cast-section.tsx`,
`media-credit-section.tsx`, `season-container.tsx`, `current-season.tsx`,
`inline-episode-browser.tsx`, `collections.tsx`, `genre-container.tsx`,
`media-keywords.tsx`, `media-lightbox-dialog.tsx`, `rating-count.tsx`,
`media-description.tsx`, `media-recommendation.tsx`.

### `watchlist/`
`watchlist-grid.tsx`, `watchlist-card.tsx`, `watchlist-filters.tsx`,
`list-collage.tsx`, `custom-list-view.tsx`, `custom-list-card.tsx`,
`custom-list-media-card.tsx`, `silent-error-boundary.tsx`.

### `recommendations/`
`recommendation-filters.tsx` (filters + era presets), `recommendation-results.tsx`
(result grid), `recommendation-history.tsx` (accordion history),
`loading-skeletons.tsx`, `recommendation-utils.ts`.

### `admin/`
`admin-dashboard.tsx`, `admin-user-table.tsx` (orchestrator),
`admin-user-row.tsx`, `admin-role-dialog.tsx`, `admin-permission-toggles.tsx`,
`use-admin-users.ts` (data hook).

### Top-level widgets
`navbar.tsx`, `footer.tsx`, `mobile-bottom-nav.tsx`, `desktop-nav-button.tsx`,
`media-card.tsx` (grid/carousel card), `homepage-media.tsx` (homepage rows),
`homepage-recommendations.tsx` ("Picks For You" row + feedback),
`daily-pick.tsx` (daily pick widget, thin UI over `useDailyPick`),
`video-player-modal.tsx` (fullscreen player), `watchlist-button.tsx`,
`custom-list-dialog.tsx`, `custom-list-picker.tsx`, `filter-bar.tsx`,
`share-button.tsx`, `scroll-container.tsx`, `user-sync.tsx` (local→remote
promotion), `banned-screen.tsx`, `go-back.tsx`, `default-loader.tsx`,
`default-not-found.tsx` (error + not-found), `default-empty-state.tsx`.

## `src/routes/` — file-based routes

| File | What it is |
| :--- | :--- |
| `__root.tsx` | Root layout: meta tags, nav/footer, toaster, `UserSync`, skip link, app CSS. |
| `index.tsx` | Homepage: search bar, trending/popular/top-rated rows, daily pick, "Picks For You". |
| `list.$type.$slug.tsx` | Curated list pages (`/list/movies/popular`, ...) with pagination. |
| `person.$id.tsx` | Person/actor page (biography + filmography). |
| `keyword.$id.tsx` | Keyword-tagged movies page (TMDB discover). |
| `collection.$id.{-$slug}.tsx` | Collection page with canonical slug redirect. |
| `search.tsx` + `search.lazy.tsx` | Search shell (param validation + head) and lazy search UI (cross-media results + history). |
| `watchlist.tsx` + `watchlist.lazy.tsx` | Watchlist shell and lazy UI (filters, grid, import/export, lists). |
| `recommendations.tsx` + `recommendations.lazy.tsx` | AI recommendations shell and lazy UI (filters → results → history). |
| `admin.tsx` | Admin dashboard gate (admin-only via `usePermissions`). |
| `disclaimer.tsx` | Static disclaimer/terms page. |
| `api.metaimage.ts` | OG-image endpoint: 302-redirects to the TMDB poster/backdrop (with placeholder fallback), immutable cache headers. |
| `movie/$id/{-$slug}/index.tsx` | Movie detail page (details, cast, media tabs, watchlist controls). |
| `movie/$id/{-$slug}/media.tsx` | Movie media gallery (backdrops/posters/videos). |
| `movie/$id/{-$slug}/cast-crew.tsx` | Movie cast & crew page. |
| `tv/$id/{-$slug}/index.tsx` | TV show detail page (overview, seasons, episodes, watchlist). |
| `tv/$id/{-$slug}/seasons.tsx` | TV seasons index. |
| `tv/$id/{-$slug}/season.$seasonNumber.tsx` | Single season page with per-episode watched state. |
| `tv/$id/{-$slug}/media.tsx` | TV media gallery. |
| `tv/$id/{-$slug}/cast-crew.tsx` | TV cast & crew page. |

## `public/` — static assets

Icons/favicons (apple-touch, android-chrome, mstile sets), `logo.svg`,
`favicon.svg`, `image_not_found.jpg`, `manifest.json`, `robots.txt`,
`offline.html` and `sw.js` (service worker), plus Vite/PWA metadata.

---

## Maintenance notes

- **Generated files** (never hand-edit): `src/routeTree.gen.ts`,
  `.output/`, `.nitro/`, `.wrangler/`, `.tanstack/`, `pnpm-lock.yaml` (update
  via pnpm), `drizzle/meta/`.
- **Legacy leftovers** to be aware of: `public/sw.js` + `offline.html`
  (service worker assets). The stale `.vercel/` directory was removed
  (2026-08-16); its preview env vars were preserved in the gitignored
  `.env.vercel-preview.local` backup.
- **Where new backend code goes:** a new server fn in `src/server/fns/` +
  a Valibot schema in `src/server/schema/`; wire the client through
  `src/lib/repository/` (remote + local) so both auth states stay consistent.
- **Where new queries go:** TMDB fetch → `src/lib/queries.ts` (+ schema in
  `tmdb-schemas.ts`), key in `src/lib/query/keys.ts`, hook in `src/hooks/`.
