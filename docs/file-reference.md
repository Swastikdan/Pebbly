# File reference

A per-file map of the repository: what each file is and why it exists. Line
counts are approximate (as of 2026-08-23). Entries are grouped by directory.

---

## Root configuration

| File                                | What it is                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`                      | App metadata + scripts (`dev`, `build`, `db:*`, `deploy:cf`, `lint`, `format`, `format:check`, `typecheck`), deps (TanStack Start/Router/Query, React 19, Base UI, Drizzle, Valibot, Clerk, h3, Nitro, Tailwind 4, Zustand, better-fetch, lucide) and dev deps (Vite 8, Wrangler, Biome, Prettier, drizzle-kit, husky). `packageManager: pnpm@10.6.1`. lint-staged runs Prettier (write) + Biome (check --fix) on staged files. |
| `pnpm-workspace.yaml`               | Workspace + supply-chain policy: dependency trust allowlist (packages that may run install scripts, e.g. `esbuild`, `@clerk/shared`), `minimumReleaseAge`, no-downgrade trust policy.                                                                                                                                                                                                                                           |
| `pnpm-lock.yaml`                    | Lockfile for reproducible installs.                                                                                                                                                                                                                                                                                                                                                                                             |
| `tsconfig.json`                     | Strict TS config (`strict`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`), bundler module resolution, `@/*` → `./src/*` path alias, `noEmit` (Vite builds).                                                                                                                                                                                                                                                        |
| `vite.config.ts`                    | Vite build: Nitro plugin, TanStack Start plugin, React plugin with the React Compiler Babel plugin, Tailwind v4, path aliases. Terser minification with `drop_console` in prod, manual vendor chunking (react/tanstack/clerk/icons), flat hashed output names, `envPrefix: ["VITE_"]` (only `VITE_*` vars reach the client).                                                                                                    |
| `nitro.config.ts`                   | Nitro server config: scans `server/`, enables the task system, maps cron `0 3 * * *` → task `snapshots`, adds cache-control (assets) + security headers, and switches to the `cloudflare_module` preset in production.                                                                                                                                                                                                          |
| `wrangler.toml`                     | Cloudflare Worker definition: name `pebbly`, entry `.output/server/index.mjs`, `nodejs_compat` flag, `ASSETS` binding for static files, `DB` D1 binding (+migrations dir), cron trigger `0 3 * * *`, observability (logs + traces).                                                                                                                                                                                             |
| `wrangler.preview.toml`             | **Preview** Worker definition for `cf-*` branches: separate `pebbly-preview` D1 database, `APP_ENV=preview`, no cron, `no_bundle = true` + ESModule rules (Nitro pre-bundles). Deployed with `--config` (never `--env`).                                                                                                                                                                                                        |
| `drizzle.config.ts`                 | Drizzle Kit _generate-only_ config: SQLite dialect, schema `src/server/db/schema.ts`, output `drizzle/`. No driver needed (migrations are applied by wrangler).                                                                                                                                                                                                                                                                 |
| `drizzle.studio.config.ts`          | Drizzle Studio dashboard config for the **remote** D1 DB via `d1-http` (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`). Parses the `database_id` out of `wrangler.toml`.                                                                                                                                                                                                                                               |
| `biome.json`                        | Biome **lint** config (formatter disabled; formatting belongs to Prettier): scoped to `src/**` + a few roots, `routeTree.gen.ts` and `styles.css` excluded, a11y `noSvgWithoutTitle` off.                                                                                                                                                                                                                                       |
| `.prettierrc`                       | The formatter config: `@ianvs/prettier-plugin-sort-imports` + `prettier-plugin-tailwindcss`, custom import order, `cn`/`cva` as Tailwind class functions.                                                                                                                                                                                                                                                                       |
| `.prettierignore`                   | Formatter exclusions (lockfile, build dirs, generated route tree, `drizzle/`, `public/`).                                                                                                                                                                                                                                                                                                                                       |
| `components.json`                   | Component registry config for the coss ui CLI (shadcn-registry-compatible; adds the `@coss` registry; the components themselves are Base UI-based).                                                                                                                                                                                                                                                                             |
| `.env.example`                      | Documented env template: Clerk (client + server), TMDB, optional local Gemini fallback, and Cloudflare vars. Local dev secrets live in `.dev.vars`; production uses `wrangler secret put`.                                                                                                                                                                                                                                      |
| `.env` / `.env.local` / `.dev.vars` | Local secrets (gitignored); `.dev.vars` feeds `wrangler dev`.                                                                                                                                                                                                                                                                                                                                                                   |
| `.gitignore`                        | Ignored paths (node_modules, .output, .wrangler, env files, etc.).                                                                                                                                                                                                                                                                                                                                                              |
| `.husky/pre-commit`                 | Husky git hook running `lint-staged`.                                                                                                                                                                                                                                                                                                                                                                                           |
| `README.md`                         | Project readme: features, stack, setup, scripts, deployment.                                                                                                                                                                                                                                                                                                                                                                    |
| `plan/`                             | Working plans for in-flight refactors. Historical context, not runtime code.                                                                                                                                                                                                                                                                                                                                                    |

## `server/`: Nitro layer (framework-agnostic entry points)

| File                   | What it is                                                                                                                                                                                                                                                                                |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes/api/health.ts` | `GET /api/health`, pings D1 (`select 1`), returns `{ ok, service, timestamp, checks, durationMs }`; `503` when the DB is unavailable; result memoized 10 s (failures ~5 s) and the check is skipped without a D1 binding (plain `vite dev`). Never leaks raw DB errors (public endpoint). |
| `tasks/snapshots.ts`   | Nitro task `snapshots` run by the `0 3 * * *` cron. Reads/persists the `watchlist_snapshot_cursor`, calls `createDailySnapshots` (≤200 users/run, keyset pages of 50), returns a run summary.                                                                                             |

## `drizzle/`: SQL migrations

| File                          | What it is                                                                                                              |
| :---------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `0000_dear_warbound.sql`      | Initial schema: all tables + indexes + check constraints (`users` still had `is_admin`; ratings were integers).         |
| `0001_slippery_cammi.sql`     | Table rebuilds: `role_permissions` gains a real composite PK; `list_items.rating` / `watch_items.rating` become `real`. |
| `0002_cute_bloodstrike.sql`   | Adds `snapshot_cursors`.                                                                                                |
| `0003_petite_sugar_man.sql`   | Drops `users.is_admin` (admin now resolved from Clerk only).                                                            |
| `0004_wise_sabretooth.sql`    | Adds `users.watchlist_rev`.                                                                                             |
| `0005_yellow_rafael_vega.sql` | Adds `users.lists_rev` + `users.ai_rev`.                                                                                |
| `0006_wild_iron_man.sql`      | Adds `users.perms_rev` (RBAC revision counter).                                                                         |
| `0007_misty_vance_astro.sql`  | Adds `list_items.position`, `lists.description`, `lists.sort_type` (public collections with ranked ordering).           |
| `meta/`                       | Drizzle Kit journal metadata (which migrations are applied).                                                            |

## `.github/workflows/`: CI/CD

| File          | What it is                                                                                                                                                                                                                                                                                                                                   |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`      | PR checks against the `cloudflare` branch: install → typecheck → lint → build with build-time `VITE_*` vars only (no Cloudflare secrets); concurrency cancels superseded runs.                                                                                                                                                               |
| `deploy.yml`  | Production deploy on push to `cloudflare` (owner-gated, plus manual dispatch): install → typecheck → lint → D1 migrations (prod) → build with `VITE_*` secrets → `wrangler deploy`. Concurrency serializes prod jobs; actions pinned to node24 runtimes (checkout v7, setup-node v7, pnpm/action-setup v6, wrangler-action v4), see ADR-014. |
| `preview.yml` | Preview deploy on push to any `cf-*` branch: same skeleton but applies migrations to and deploys the **preview** Worker/D1 via `wrangler.preview.toml` (`--config`).                                                                                                                                                                         |

Other `.github/` files: issue templates (`bug_report.yml`, `feature_request.yml`, `config.yml`) and `pull_request_template.md`.

## `src/`: application root

| File                     | What it is                                                                                                                                                                                                                                        |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `start.ts`               | Client `createStart` instance: custom `serverFns.fetch` attaches a fresh Clerk Bearer token + 30 s abort timeout; `createCsrfMiddleware` protects server-fn RPCs from cross-site abuse.                                                           |
| `router.tsx`             | `getRouter()` builds the TanStack Router: routeTree, ClerkProvider + QueryProvider wrappers (`Wrap`), SSR↔query integration, defaults (intent preloading, pendingMs 250, staleTime 30 s, pending/not-found/error components, scroll restoration). |
| `routeTree.gen.ts`       | **Generated** route tree (TanStack router plugin). Do not edit.                                                                                                                                                                                   |
| `styles.css`             | Tailwind v4 global styles + design tokens (~700 lines; dead tokens pruned in the wave-5 CSS cleanup).                                                                                                                                             |
| `types.d.ts`             | Compatibility type re-exports; query-shape declarations live in `src/domain/media-query.ts` and other shared contracts live under `src/domain/`.                                                                                                  |
| `constants.ts`           | `SITE_CONFIG` (name, URL, nav), `MEDIA_PAGE_SLUGS`, `GENRE_LIST`, `IMAGE_PREFIX` (TMDB image size URLs), `MAX_PAGINATION_LIMIT = 500`, RBAC labels, placeholder image.                                                                            |
| `constants/watchlist.ts` | Watchlist-specific constants (status/reaction label/icon maps).                                                                                                                                                                                   |

## `src/server/`: backend

| File                         | What it is                                                                                                                                                                                                                                                                                                                                                                  |
| :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.ts`                     | Worker env access: `getEnv()` reads `globalThis.__env__` (Nitro) with `process.env` fallback; `validateEnv()` (once per isolate) validates string vars with Valibot and logs actionable warnings (loud for missing `CLERK_SECRET_KEY`); `isPreview()`.                                                                                                                      |
| `auth.ts`                    | Clerk session handling: `getSessionToken` (Bearer → cookie), `getSessionClaims` (JWT verify, 10 s skew), `requireUser` (resolve-or-create user, race-safe), `getCurrentUser`, `findUserByClaims` (multi-format tokenIdentifier + 15 s / 500-entry LRU cache), admin helpers (`isAdminByClaims` from JWT, the sole access-decision source; `getClerkAdminIds` display-only). |
| `rbac.ts`                    | Feature-flag RBAC: `hasFeature`, `getUserFeatures`, `syncRolePermissions`; admin short-circuits from Clerk (never a stored flag); `global` kill switch + per-role permission rows + `DEFAULT_PERMISSIONS`.                                                                                                                                                                  |
| `prompts.ts`                 | Pure AI prompt builders (`buildWatchlistPrompt`, `buildGenrePrompt`, `buildCustomListPrompt`, `buildHomepageRecommendationsPrompt`) over one shared sectioned builder. Dependency-free; lives server-side because the recommendation fns are its only consumer.                                                                                                             |
| `ai.ts`                      | Provider-neutral `generateRecommendations` seam over Workers AI production and the optional local adapter; JSON mode, per-element Valibot validation, retries, and normalized provider error codes.                                                                                                                                                                         |
| `ai-gemini.ts`               | Private local Gemini REST adapter: fallback model order, request/response handling, retry-on-400 thinking fallback, and Gemini-specific error classification.                                                                                                                                                                                                               |
| `db/client.ts`               | `getDb(env)`, cached Drizzle D1 instance per binding (WeakMap), fail-fast on a missing `DB` binding, `runBatch` for bounded transactional batches (chunks of ≤100 statements).                                                                                                                                                                                              |
| `db/schema.ts`               | The Drizzle schema for all 11 tables (see [data-model.md](./data-model.md)).                                                                                                                                                                                                                                                                                                |
| `helpers/watch-item.ts`      | Shared watch-item logic: `getWatchItem`, enum normalization against the SSOT Sets, `buildMetadataPatch` (rating clamped 0–10), `planMembershipRemoval` (detach-vs-delete on watchlist removal), `upsertWatchItem` (race-safe upsert on `(user, tmdb, mediaType)`), `bumpUserRev` + `bumpWatchlistRev`/`bumpListsRev`/`bumpAiRev`/`bumpPermsRev` revision counters.          |
| `helpers/episode-sync.ts`    | Episode-progress engine shared by the watchlist fns: `buildEpisodeSyncStatements`, `loadEpisodeRowsByKey` (offset pagination, 500/page until short page), `syncEpisodeProgressRecord` (one read + one batch + rev bump).                                                                                                                                                    |
| `helpers/snapshots.ts`       | `createWatchlistSnapshot` (dedupe against latest) and `createDailySnapshots` (keyset-paginated pages of 50, ≤200 users/run).                                                                                                                                                                                                                                                |
| `fns/rpc.ts`                 | The shared guard pipeline: `authedFn(config, data, handler)` (mode/guest/feature/admin gates, injects `{ data, user, claims, db }`), `guestFallback`, `resolveRequiredAuth` escape hatch. Replaced four hand-written guard idioms across all server fns.                                                                                                                    |
| `fns/watchlist.ts`           | Watchlist + episode server fns (see [server-layer.md](./server-layer.md#6-server-functions-srcserverfns)).                                                                                                                                                                                                                                                                  |
| `fns/lists.ts`               | Custom-list CRUD + item toggling/reordering + cloning + public collection pages (`getCollectionPage`) + enriched reads.                                                                                                                                                                                                                                                     |
| `fns/import-export.ts`       | Bulk watchlist import with bounded D1 batches.                                                                                                                                                                                                                                                                                                                              |
| `fns/recommendations.ts`     | Thin authenticated AI-generation adapters plus homepage/history/feedback APIs; shared generation choreography lives in `recommendation-pipeline.ts`. Picks-list writes live in `services/picks-list.ts`.                                                                                                                                                                    |
| `recommendation-pipeline.ts` | Shared history/homepage AI-generation pipeline: exclusions, candidates, prompts, provider calls, persistence, and rate-limit release.                                                                                                                                                                                                                                       |
| `fns/admin.ts`               | Admin-only user/role/permission management.                                                                                                                                                                                                                                                                                                                                 |
| `fns/users.ts`               | `storeUser` upsert from Clerk identity.                                                                                                                                                                                                                                                                                                                                     |
| `schema/common.ts`           | The enum SSOT: `PROGRESS_STATUSES` / `REACTIONS` arrays feeding Valibot picklists, validation Sets, and Drizzle enums; `ApiResult`, error codes, `ok`/`fail`, `ApiError`, `unwrap`.                                                                                                                                                                                         |
| `schema/watchlist.ts`        | Valibot schemas for every watchlist server-fn argument.                                                                                                                                                                                                                                                                                                                     |
| `schema/lists.ts`            | Valibot schemas for list server fns.                                                                                                                                                                                                                                                                                                                                        |
| `schema/recommendations.ts`  | Valibot schemas for recommendation server fns + `MAX_EXCLUDE_TMDB_IDS`.                                                                                                                                                                                                                                                                                                     |
| `schema/admin.ts`            | Valibot schemas for admin server fns.                                                                                                                                                                                                                                                                                                                                       |
| `schema/import.ts`           | Valibot schema for watchlist import payloads.                                                                                                                                                                                                                                                                                                                               |

## `src/stores/`: Zustand guest/local state

| File                      | What it is                                                                                                                                                                                            |
| :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `watchlist-store.ts`      | Zustand guest watchlist store (persisted, LRU storage): membership/progress/reaction mutators + `importWatchlistLocal`.                                                                               |
| `local-lists-store.ts`    | Zustand guest custom-lists store (persisted).                                                                                                                                                         |
| `local-progress-store.ts` | Zustand guest progress store (persisted; includes `lastPlayed` and per-episode watched state).                                                                                                        |
| `daily-pick-store.ts`     | Persisted bounded per-title backdrop/poster metadata cache for daily pick; trending and popular-TV catalogs come from React Query.                                                                    |
| `guest-store-kit.ts`      | Shared persistence plumbing: `guestPersistOptions`/`guardedMerge` with optional per-store sanitizers, LRU storage on client, memory during SSR, plus `localId`, `nextRank`, and `mergeDefinedFields`. |

## `src/domain/`: dependency-free shared contracts

| File                 | What it is                                                                           |
| :------------------- | :----------------------------------------------------------------------------------- |
| `media.ts`           | Canonical media types, runtime values, type guard, and route-slug mappings.          |
| `watchlist.ts`       | Watchlist progress/reaction values, metadata contracts, and watchlist identity keys. |
| `recommendations.ts` | Shared AI recommendation contract.                                                   |
| `notifications.ts`   | Shared toast/notifier option types.                                                  |
| `object.ts`          | Pure generic object helpers such as `mergeDefinedFields`.                            |

## `src/lib/`: client/shared utilities

| File                                      | What it is                                                                                                                                                                                                                               |
| :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tmdb.ts`                                 | `getTmdbFetch`, lazily constructed `@better-fetch/fetch` client for TMDB (Bearer token, 15 s timeout, linear retry on 408/429/5xx).                                                                                                      |
| `tmdb-schemas.ts`                         | Valibot schemas for every TMDB response shape (~670 lines).                                                                                                                                                                              |
| `queries.ts`                              | Typed TMDB query functions (`getMediaList`, `getMovieDetails`, `getTvDetails`, `getBasicMovieDetails/TvDetails`, `getCredits`, `getSearchResult`, ...) with `MEDIA_LIST_PATHS` as the endpoint map.                                      |
| `batcher.ts`                              | Generic `RequestBatcher`: debounce/max-wait/max-batch-size/dedupe-by-key, optional flush-on-page-hide + dispose.                                                                                                                         |
| `realtime-mutations.ts`                   | Per-domain own-mutation counters (`watchlist`/`lists`/`ai`) recorded on successful server writes, lets `user-sync.tsx` skip redundant refetches for the client's own changes (see ADR-015).                                              |
| `cross-tab-sync.ts`                       | BroadcastChannel (`pebbly-sync`) fan-out: sibling tabs invalidate each other's query groups instantly, no server round trip.                                                                                                             |
| `media-types.ts`                          | Canonical `MediaType` module: `"movie" \| "tv"` union, Valibot schema, type guard, route-slug map.                                                                                                                                       |
| `text.ts`                                 | Tiny pure string helpers (`normalizeTitleKey`, `hashString`) shared by prompts and TMDB verification.                                                                                                                                    |
| `daily-pick-engine.ts`                    | Pure "Tonight's Pick" selection engine (seeded by date; interleaving + scoring); no React/clocks/network; consumed by `use-daily-pick.ts`.                                                                                               |
| `segmented-control.ts`                    | Shared helpers/styles for segmented filter controls.                                                                                                                                                                                     |
| `utils.ts`                                | `cn`, `normalizeProgressStatus`, `inferStatusFromProgress` (the ≥95/>0 rule), `createLRUStorage`/`createMemoryStorage` (4 MB localStorage quota management), `validateId`/`parseAndValidateId`, `formatMediaTitle` (slug encode/decode). |
| `media-transform.ts`                      | Pure TMDB→UI transforms: genre lookup, video split, cast/crew, backdrops/posters with size prefixes, certifications, runtime.                                                                                                            |
| `media-page.ts`                           | `buildSharedMediaPageData`, shared view-model for movie/TV detail pages.                                                                                                                                                                 |
| `media-route-options.ts`                  | Option factories for the movie/tv twin routes: `indexRouteOptions`, `mediaRouteOptions`, `castCrewRouteOptions`, `basicDetailsQuery` + search-param validators. Each route keeps only the literal `createFileRoute` call.                |
| `route-helpers.ts`                        | Loader/head ceremony shared by detail-style routes: `requireRouteId`, `loadMediaRouteData` (awaited details hydration so SSR og:image sees real posters), `detailHead`.                                                                  |
| `media-dialog-helpers.ts`                 | Dialog state stored in URL search params (video/backdrop/poster lightbox).                                                                                                                                                               |
| `meta-image-tags.ts`                      | `MetaImageTagsGenerator`, OpenGraph/Twitter meta tags.                                                                                                                                                                                   |
| `search-history.ts`                       | localStorage search history (max 8 items).                                                                                                                                                                                               |
| `server-types.ts`                         | Client-side aliases of D1 row types.                                                                                                                                                                                                     |
| `repository/types.ts`                     | `WatchlistRepository` + `ListsRepository` interfaces + `resolveProgressStatusAction`/`resolveStatusPlan`, the shared progress decision pipeline.                                                                                         |
| `repository/remote-repository.ts`         | Server-backed repository: optimistic journal, persistent mutation outbox/replay, membership batcher, journaled mutations, and list ops with id swapping.                                                                                 |
| `data/mutation-outbox.ts`                 | Best-effort localStorage outbox for idempotent signed-in watchlist writes; user-scoped, coalesced, schema-validated on replay, and removed after server success.                                                                         |
| `recommendation-options.ts`               | Pure homepage recommendation filtering and dismissal-key policy shared by the controller and renderer.                                                                                                                                   |
| `repository/local-repository.ts`          | Zustand-backed repository for signed-out users.                                                                                                                                                                                          |
| `repository/use-repository.ts`            | `useRepository()`, picks remote vs local by auth state.                                                                                                                                                                                  |
| `data/pending-ops.ts`                     | The optimistic journal: `beginOp`, `reconcileListFetch`, `applyServerState`, `scheduleSync`, `clearPendingOps`. Client-only; scoped per QueryClient via WeakMap.                                                                         |
| `data/watchlist-queries.ts`               | Watchlist query fns routed through the journal reconciler before entering the cache.                                                                                                                                                     |
| `data/optimistic/watchlist-optimistic.ts` | Pure optimistic op builders for watchlist mutations (incl. `buildSeasonEpisodeSelections`) + shared progress row transforms.                                                                                                             |
| `data/optimistic/list-optimistic.ts`      | Pure optimistic op builders for custom-list CRUD (`beginCreateListOp`, `beginToggleListItemOp`, `beginReorderListItemsOp`, `swapListId`, ...).                                                                                           |
| `query/query-client.ts`                   | `getContext()`, fresh QueryClient per render/request with 24 h defaults.                                                                                                                                                                 |
| `query/root-provider.tsx`                 | React context provider for the QueryClient.                                                                                                                                                                                              |
| `query/devtools.ts`                       | Dev-only React Query devtools.                                                                                                                                                                                                           |
| `query/keys.ts`                           | `queryKeys`, centralized, user-scoped query-key factory + `listsSyncKeys`.                                                                                                                                                               |

Layering note: nothing in `src/lib/` imports from `src/hooks/`. Pure data
modules live here, hooks live in `src/hooks/`.

## `src/hooks/`: React hooks

| File                                    | What it is                                                                                                                            |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `use-watchlist.ts`                      | Thin read/mutation hooks delegating to the repository (~175 lines).                                                                   |
| `use-watchlist-import-export.ts`        | Watchlist export/import (JSON) including guest→remote promotion (~440 lines).                                                         |
| `use-custom-lists.ts`                   | Custom-list reads + mutations through the journal-reconciled queries (~110 lines).                                                    |
| `use-recommendations.ts`                | AI recommendation queries/mutations (history, generate, feedback; caps exclusions at 1000 ids).                                       |
| `use-homepage-recommendations.ts`       | Homepage recommendation controller: scoped queries, refresh/generation guard, rendered filtering, and optimistic feedback mutations.  |
| `use-tmdb-verification.ts`              | Verifies AI-suggested titles against TMDB: `useTmdbData` (direct fetch), `useTmdbSearchFallback` (title search), `normalizeTmdbData`. |
| `use-resolved-recommendation.ts`        | Resolution machine for AI rec cards (verify id → search fallback), skippable via `enabled: false`.                                    |
| `use-daily-pick.ts`                     | "Tonight's Pick" orchestration over the pure engine + offline store (~260 lines).                                                     |
| `use-remove-with-undo.ts`               | Removes a watchlist item immediately with an Undo toast that performs the inverse toggle.                                             |
| `use-url-paged-query.ts`                | URL-driven pagination helper (page param sync, clamp to `MAX_PAGINATION_LIMIT`, optional scroll-to-top).                              |
| `use-filtered-watchlist.ts`             | Filter/sort logic for the watchlist tab.                                                                                              |
| `use-season-details.ts`                 | Batched TV season-detail fetching via a shared `RequestBatcher` onto the canonical `seasonDetails` key.                               |
| `use-permissions.ts`                    | Client RBAC summary from `getUserFeaturesFn`; refetches on focus and on `permsRev` deltas (no fixed poll).                            |
| `data-version.ts`                       | `fetchDataVersion`, client fetch for the combined per-user revision counters, polled by `user-sync.tsx`.                              |
| `use-canonical-slug-redirect.ts`        | Client redirect to the canonical `/{type}/{id}/{slug}` URL (moved here from lib; it's a hook).                                        |
| `use-theme.ts`                          | Light/dark/system theme: preference store, pre-paint DOM application, View Transitions crossfade, `toggleTheme`.                      |
| `use-destructive-toast.ts`              | Confirmation toast that defers destructive actions until countdown expiry unless undone.                                              |
| `use-toast-store.ts`                    | Fire-and-forget `toast()` backed by Base UI's toast manager (no provider needed at call sites).                                       |
| `watch-progress/use-watch-progress.ts`  | Watch/player progress orchestration (~450 lines): data fetching, progress calculations, mutations.                                    |
| `watch-progress/use-player-listener.ts` | postMessage listener for player progress (origin-verified, DOM-scan fallback).                                                        |
| `lib/watch-progress.ts`                 | Dependency-free progress/player contracts, validation, optimistic episode helpers, and `buildPlayerUrl`.                              |
| `watch-progress/progress-helpers.ts`    | Compatibility re-export of `lib/watch-progress.ts`.                                                                                   |

## `src/components/`: UI

### `ui/`: primitives (coss ui on Base UI)

`button.tsx`, `badge.tsx`, `dialog.tsx`, `menu.tsx`, `select.tsx`, `sheet.tsx`,
`tabs.tsx`, `accordion.tsx`, `input.tsx`, `label.tsx`, `skeleton.tsx`,
`spinner.tsx`, `pagination.tsx`, `empty.tsx`, `feedback.tsx`, `toast.tsx`
(the `ToastProvider` + manager), plus app-specific primitives:
`image.tsx`, `media-grid.tsx`, `lazy-section.tsx`, `auto-scroll-title.tsx`,
`search-bar.tsx` (debounced URL-navigation input with history), `icons.tsx`
(hand-rolled lucide-compatible SVG set).

### `media/`: detail-page blocks

**`media-detail-page.tsx`** (shared index-page layout with `aboveMedia`/
`belowMedia` slots), **`basic-media-pages.tsx`** (`MediaGalleryPage` +
`MediaCreditsPage` bodies shared by the four media/cast-crew twin routes),
**`media-thumb-rail.tsx`** (generic deep-linking thumbnail rail),
`media-container.tsx` (page layout), `media-title-container.tsx`,
`media-video-image-container.tsx`, `media-poster-trailer-container.tsx`,
`watchlist-status-menu.tsx`, `cast-section.tsx`, `media-credit-section.tsx`,
`inline-episode-browser.tsx`, `collections.tsx`, `genre-container.tsx`,
`media-keywords.tsx`, `media-lightbox-dialog.tsx`, `rating-count.tsx`,
`media-description.tsx`, `media-recommendation.tsx`.

### `watchlist/`

**`watchlist-tab.tsx`** (filters + grid paginated at 30/page + import/export;
owns `WATCHLIST_PAGE_SIZE`) and **`my-lists-tab.tsx`** (custom lists + create
flow), composed as tabs by the watchlist route.
`media-row-card-shell.tsx` (shared row-card chrome + static pills for
watchlist/collection cards), `watchlist-grid.tsx`, `watchlist-card.tsx`,
`watchlist-filters.tsx`, `list-collage.tsx`, `collection-page.tsx` (public
`/c/$id` view: edit/reorder/clone for the owner, sanitized for visitors),
`custom-list-card.tsx`, `custom-list-media-card.tsx`,
`silent-error-boundary.tsx`.

### `recommendations/`

`recommendation-filters.tsx` (filters + era presets), `recommendation-results.tsx`
(verified result cards), `recommendation-history.tsx` (history),
`recommendation-utils.ts`.

### `admin/`

`admin-dashboard.tsx` (tabbed: Users / Permissions), `admin-user-table.tsx`
(orchestrator), `admin-user-row.tsx`, `admin-role-dialog.tsx`,
`admin-permission-toggles.tsx`, `use-admin-users.ts` (data hook, 10 s polling
while the admin page is open).

### Top-level widgets

`paged-media-grid.tsx` (paginated grid wrapper used by list + keyword routes),
`media-skeleton-list.tsx` (loading rail; feature-level so kept out of `ui/`),
`navbar.tsx`, `footer.tsx` + `footer-theme-select.tsx` (light/dark/system),
`mobile-bottom-nav.tsx`, `desktop-nav-button.tsx`,
`navigation-progress-bar.tsx` (top loading bar), `media-card.tsx`
(grid/carousel card), `homepage-media.tsx` (homepage rows),
`homepage-recommendations.tsx` ("Picks For You" row + feedback),
`daily-pick.tsx` (daily pick widget with theme-aware backdrop placeholder),
`video-player-modal.tsx` (fullscreen player), `watchlist-button.tsx`,
`custom-list-dialog.tsx`, `share-button.tsx`, `scroll-container.tsx`,
`user-sync.tsx` (session sync + ban enforcement + cross-device realtime:
adaptive version poll that invalidates query groups only when a revision moved
beyond this client's own writes), `go-back.tsx`, `default-loader.tsx`,
`default-not-found.tsx` (error + not-found), `default-empty-state.tsx`.

## `src/routes/`: file-based routes

| File                                               | What it is                                                                                                                                                                                                           |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__root.tsx`                                       | Root layout document: meta tags + PWA headers, blocking theme-init script, `ToastProvider`, `NavigationProgressBar`, nav/footer/mobile nav, `UserSync`, skip link, `/` search shortcut, service-worker registration. |
| `index.tsx`                                        | Homepage: search bar, trending/popular/top-rated rows, daily pick, "Picks For You".                                                                                                                                  |
| `list.$type.$slug.tsx`                             | Curated list pages (`/list/movies/popular`, ...) with URL pagination via `useUrlPagedQuery` + `PagedMediaGrid`.                                                                                                      |
| `person.$id.tsx`                                   | Person/actor page (biography + filmography).                                                                                                                                                                         |
| `keyword.$id.tsx`                                  | Keyword-tagged movies page (TMDB discover), paginated like the list page.                                                                                                                                            |
| `collection.$id.{-$slug}.tsx`                      | **TMDB franchise** collection page (e.g. a movie series) with canonical slug redirect.                                                                                                                               |
| `c.$id.{-$slug}.tsx`                               | **User-created list** shared as a public page: loader fetches `getCollectionPage` (owner vs visitor resolved server-side; private/missing → 404) and renders `CollectionPage`.                                       |
| `search.tsx` + `search.lazy.tsx`                   | Search shell (param validation + head) and lazy search UI (cross-media results, client filters, URL pagination, trending fallback).                                                                                  |
| `watchlist.tsx` + `watchlist.lazy.tsx`             | Watchlist shell and lazy UI composing the `WatchlistTab` / `MyListsTab` tabs (tab persisted in the `tab` search param).                                                                                              |
| `recommendations.tsx` + `recommendations.lazy.tsx` | AI recommendations shell and lazy UI (filters → results → history; gated by sign-in + `ai-recommendations`).                                                                                                         |
| `admin.tsx`                                        | Admin dashboard gate (admin-only via `usePermissions`).                                                                                                                                                              |
| `disclaimer.tsx`                                   | Static disclaimer/terms page.                                                                                                                                                                                        |
| `api.metaimage.ts`                                 | OG-image endpoint: 302-redirects to the TMDB poster/backdrop (with placeholder fallback), immutable cache headers.                                                                                                   |
| `movie/$id/{-$slug}/index.tsx`                     | Movie detail page: literal `createFileRoute` + `indexRouteOptions("movie", ...)`; kind-specific derivations stay inline, layout comes from `MediaDetailPage`.                                                        |
| `movie/$id/{-$slug}/media.tsx`                     | Movie media gallery: `mediaRouteOptions("movie", ...)` rendering `MediaGalleryPage`.                                                                                                                                 |
| `movie/$id/{-$slug}/cast-crew.tsx`                 | Movie cast & crew: `castCrewRouteOptions("movie", ...)` rendering `MediaCreditsPage`.                                                                                                                                |
| `tv/$id/{-$slug}/index.tsx`                        | TV show detail page (same factory pattern as movie; episode browser injected via `aboveMedia`).                                                                                                                      |
| `tv/$id/{-$slug}/seasons.tsx`                      | TV seasons index (inline loader/head using `loadMediaRouteData`).                                                                                                                                                    |
| `tv/$id/{-$slug}/season.$seasonNumber.tsx`         | Single season page with per-episode watched state.                                                                                                                                                                   |
| `tv/$id/{-$slug}/media.tsx`                        | TV media gallery, same factories as movie.                                                                                                                                                                           |
| `tv/$id/{-$slug}/cast-crew.tsx`                    | TV cast & crew, same factories as movie.                                                                                                                                                                             |

## `public/`: static assets

Icons/favicons (apple-touch, android-chrome, mstile sets), `logo.svg`,
`favicon.svg`, `image_not_found.jpg`, `manifest.json`, `robots.txt`,
`sw.js` (minimal no-cache service worker, keeps the app installable).

---

## Maintenance notes

- **Generated files** (never hand-edit): `src/routeTree.gen.ts`,
  `.output/`, `.nitro/`, `.wrangler/`, `.tanstack/`, `pnpm-lock.yaml` (update
  via pnpm), `drizzle/meta/`.
- **Where new backend code goes:** a new server fn in `src/server/fns/` +
  a Valibot schema in `src/server/schema/`; gate it with `authedFn` from
  `fns/rpc.ts`; wire the client through `src/lib/repository/` (remote + local)
  so both auth states stay consistent.
- **Where new queries go:** TMDB fetch → `src/lib/queries.ts` (+ schema in
  `tmdb-schemas.ts`), key in `src/lib/query/keys.ts`, hook in `src/hooks/`.
- **Where new state goes:** persisted guest stores in `src/stores/` (share
  `guest-store-kit`); pure data modules under `src/lib/data/` never import
  from hooks.
