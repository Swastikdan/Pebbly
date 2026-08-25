# Architecture overview

## 1. Tech stack

| Layer          | Technology                                                                                             | Where it lives                                                   |
| :------------- | :----------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| Framework      | TanStack Start (file-based routing) + TanStack Router + React 19                                       | `src/router.tsx`, `src/start.ts`, `src/routes/`                  |
| Runtime / host | Cloudflare Workers (Nitro `cloudflare_module` preset)                                                  | `wrangler.toml`, `nitro.config.ts`                               |
| Database       | Cloudflare D1 (SQLite) via Drizzle ORM                                                                 | `src/server/db/`, `drizzle/`                                     |
| Validation     | Valibot (schemas shared between client and server fns)                                                 | `src/server/schema/`, `src/lib/tmdb-schemas.ts`                  |
| Auth           | Clerk (`@clerk/react` client, `@clerk/backend` JWT verification)                                       | `src/server/auth.ts`, `src/start.ts`                             |
| AI             | Google Gemini over REST (`generativelanguage.googleapis.com`)                                          | `src/server/ai.ts`, `src/server/prompts.ts`                      |
| Media metadata | TMDB REST API (`@better-fetch/fetch` client)                                                           | `src/lib/tmdb.ts`, `src/lib/queries.ts`                          |
| Client data    | TanStack Query (React Query)                                                                           | `src/lib/query/`                                                 |
| Client state   | Zustand (persisted to localStorage with LRU eviction)                                                  | `src/stores/`                                                    |
| Styling        | Tailwind CSS v4 + **coss ui** components built on Base UI (`@base-ui/react`), light/dark/system themes | `src/components/ui/`, `src/styles.css`, `src/hooks/use-theme.ts` |
| Tooling        | Vite 7, Prettier (formatting) + Biome (linting only), TypeScript strict, Wrangler                      | root config files                                                |

Formatting is owned by **Prettier** (`.prettierrc`: import sorting +
`prettier-plugin-tailwindcss`); Biome's formatter is disabled and it runs as a
linter only (`pnpm lint`). The pre-commit hook runs both via `lint-staged`.

## 2. High-level diagram

```text
                         ┌──────────────────────────────────────────────┐
                         │                 Browser (SPA + SSR)          │
                         │  React 19 · TanStack Router · TanStack Query │
                         │  ClerkProvider · Zustand stores              │
                         └──────┬───────────────────────────┬───────────┘
                                │ SSR (Node / Worker)       │ client fetch
                                ▼                           ▼
   ┌──────────────────────────────────────┐      ┌─────────────────────────┐
   │   Nitro (h3): only 2 things          │      │  TanStack Start RPCs    │
   │   · /api/health (D1 ping)            │      │  POST /_server-fn/*     │
   │   · cron task "snapshots" (03:00)    │      │  createServerFn handlers│
   └──────────────────────────────────────┘      └───────────┬─────────────┘
                                                             │
                                     ┌───────────────────────▼─────────────┐
                                     │       src/server/ (the backend)     │
                                     │ auth.ts · rbac.ts · env.ts · ai.ts  │
                                     │ prompts.ts · fns/rpc.ts (authedFn)  │
                                     │ fns/*  (watchlist, lists, admin,    │
                                     │         recommendations, import)    │
                                     │ db/    (Drizzle client + schema)    │
                                     └───────┬───────────────────┬─────────┘
                                             │ D1 (SQLite)       │ Clerk API / Gemini REST / TMDB
                                             ▼                   ▼
                                      Cloudflare D1       External services
```

The same Worker serves both the static frontend (via the `ASSETS` binding,
`.output/public`) and the Nitro server (`.output/server/index.mjs`).

## 3. The layers

### 3.1 Routing & app shell (`src/router.tsx`, `src/start.ts`, `src/routes/`)

- `src/router.tsx` builds the TanStack Router with a ClerkProvider wrapper, a
  TanStack Query provider, SSR↔query integration, and default loader /
  not-found / error components.
- `src/start.ts` creates the client start instance and, importantly,
  customizes `serverFns.fetch` so every server-function RPC carries a fresh
  Clerk session token in `Authorization: Bearer` (the server prefers this
  header over cookies) with a 30 s abort timeout. It also installs a CSRF
  middleware scoped to server functions.
- `src/routes/` holds file-based routes. Static shells (`search.tsx`,
  `watchlist.tsx`, `recommendations.tsx`) only define metadata + search-param
  validation; the actual UI lives in the `.lazy.tsx` variants.
- **Movie/TV twin routes share one implementation.** Every detail-style route
  keeps only a literal `createFileRoute(...)` call (a router requirement) and
  delegates everything else to two shared modules:
  - `src/lib/route-helpers.ts`, the loader ceremony (`requireRouteId`,
    `loadMediaRouteData`, awaited details hydration so SSR og:image tags see
    real posters, `detailHead` meta construction).
  - `src/lib/media-route-options.ts`, option factories consumed by the route
    files: `indexRouteOptions(kind, component)`,
    `mediaRouteOptions(...)`, `castCrewRouteOptions(...)`,
    `basicDetailsQuery(kind, id)` plus the search-param validators.
    `/movie/$id/...` and `/tv/$id/...` are therefore byte-for-byte the same
    route logic parameterized by media kind.
- Two "collection" concepts coexist, and the URL scheme keeps them apart:
  `/collection/$id/...` is a **TMDB franchise** page (e.g. a movie series),
  while `/c/$id/...` is a **user-created custom list** shared as a public
  page (owner gets editing controls; visitors only ever see public lists;
  a private or missing list 404s without revealing it exists).
- `src/routeTree.gen.ts` is generated by the TanStack router plugin.

### 3.2 Server functions (`src/server/fns/`), which act as the API

Every mutating/authenticated operation is a TanStack Start server function:

| Module               | Responsibility                                                                                                                                                                   |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rpc.ts`             | The shared guard pipeline: `authedFn(config, data, handler)` resolves session → gates (feature/admin) → injects `{ data, user, claims, db }` and returns an `ApiResult` envelope |
| `watchlist.ts`       | Read/watchlist queries, membership toggle (+batch), progress status, reactions, episode progress (single/season/show), `getDataVersion` revision poll                            |
| `lists.ts`           | Custom-list CRUD + list-item toggling/reordering, public collection pages (`/c/$id`), list cloning, enriched reads                                                               |
| `import-export.ts`   | Bulk JSON watchlist import (bounded D1 batches)                                                                                                                                  |
| `recommendations.ts` | AI generation (watchlist/list/genre), homepage picks, history, feedback, rate limiting                                                                                           |
| `admin.ts`           | Admin-only: user listing, roles, ban status, feature-flag permissions                                                                                                            |
| `users.ts`           | User upsert from Clerk identity                                                                                                                                                  |

Server functions are:

- **Guarded by one builder.** `authedFn` (`fns/rpc.ts`) replaced four
  hand-written guard idioms that used to open every protected fn. Config
  options: `mode` (`"require"` = create-on-first-sign-in, `"current"` =
  resolve-without-create, `"anonymous"` = handler also runs for visitors),
  `guest` fallback response, `feature` gate (RBAC), and `admin` gate
  (JWT claim or live Clerk API). The `createServerFn(...).validator(...)`
  call stays literal at every site because the TanStack compiler statically
  extracts the `.handler(fn)` argument; `authedFn` produces its awaited result.
- **Validated on input**, every fn uses a Valibot schema via `.validator()`,
  so malformed payloads fail before touching the DB.
- **Typed on output**, every fn returns `ApiResult<T>` (a
  `{ ok: true, data } | { ok: false, code, message }` union from
  `src/server/schema/common.ts`). The client unwraps with `unwrap()`.

### 3.3 Data access (`src/server/db/`)

- `schema.ts`, the Drizzle SQLite schema (all 11 tables, indexes, checks; see
  [data-model.md](./data-model.md)).
- `client.ts`, `getDb(env)` returns a cached Drizzle instance per D1 binding
  (WeakMap keyed on the binding), plus `runBatch` which chunks multi-statement
  writes at ≤100 statements per D1 round trip.
- `helpers/`, shared DB helpers: `watch-item.ts` (upsert/normalize/membership
  removal + per-user revision counters), `episode-sync.ts` (episode progress
  statement building), and `snapshots.ts` (watchlist snapshot creation).

### 3.4 Auth & authorization (`src/server/auth.ts`, `src/server/rbac.ts`)

- `auth.ts`, extracts the Clerk token (Bearer header → cookie), verifies it
  with `@clerk/backend`, resolves the `users` row (creating it on first
  sign-in, race-safe via `onConflictDoNothing`), auto-consolidates duplicate
  user rows, and exposes a short-lived in-memory user cache (15 s TTL,
  500-entry LRU).
- `rbac.ts`, feature flags (`video-player`, `ai-recommendations`) evaluated
  from a `role_permissions` table + dynamic user roles + a **global** kill
  switch. Admin is resolved by `isAdminByClaims` (the signed JWT
  `public_meta.isAdmin` claim) or the live Clerk API, never from the DB.
  Role/ban/flag changes bump the target user's `perms_rev` counter (a global
  flag toggle bumps every user) so clients pick the change up on their next
  version poll.

### 3.5 AI recommendation engine

- `src/server/prompts.ts`, pure, dependency-free prompt builders
  (`buildWatchlistPrompt`, `buildGenrePrompt`, `buildCustomListPrompt`,
  `buildHomepageRecommendationsPrompt`) sharing one sectioned builder
  underneath. They live server-side because their single consumer is the
  recommendation fns.
- `src/server/ai.ts`, `callGeminiAI()`: REST call with per-attempt timeout,
  model fallback chain (`gemini-3.1-flash-lite` → `gemini-2.5-flash` →
  `gemini-2.0-flash` → `gemini-1.5-flash`), retries, and per-element Valibot
  validation of the JSON response.
- `src/server/fns/recommendations.ts`, generation orchestration: auth +
  feature gate (via `authedFn`), cooldown reservation (atomic insert),
  watchlist data gathering, prompt building, Gemini call, de-duplication/
  filtering against existing titles, and persistence.
- Client side, TMDB verification of AI-suggested titles is hook-based:
  `src/hooks/use-tmdb-verification.ts` (direct fetch by id + title-search
  fallback with normalized matching) and
  `src/hooks/use-resolved-recommendation.ts` (the resolution machine used by
  recommendation cards).

### 3.6 Client state & mutations

- **TanStack Query** owns server data. Query keys are centralized in
  `src/lib/query/keys.ts` (user-scoped to avoid cross-account leaks).
- **Repository pattern** (`src/lib/repository/`), the single entry point for
  mutations. `useRepository()` returns `createRemoteRepository(...)` when
  signed in (server fns + optimistic journal + request batching) or
  `createLocalRepository(...)` when signed out (Zustand + localStorage).
  Both adapters share one decision pipeline (`status-plan.ts`) for
  progress-status writes, so "what happens when you mark a show as done"
  is defined exactly once.
- **Optimistic journal** (`src/lib/data/pending-ops.ts`), every write
  registers a _replayable_ op against the query cache; server snapshots are
  merged through the journal so refetches can't clobber in-flight optimistic
  state. Its op builders live beside it in `src/lib/data/optimistic/`
  (watchlist + lists), and the journal-reconciled watchlist query fns live in
  `src/lib/data/watchlist-queries.ts`.
- **Zustand stores** persist guest/local state from `src/stores/`:
  `watchlist-store`, `local-lists-store`, `local-progress-store`,
  `daily-pick-store` (all sharing `guest-store-kit` plumbing), plus the theme
  store in `use-theme.ts` and toasts in `use-toast-store.ts`.
- **Request batching** (`src/lib/batcher.ts`), a generic debounce/max-wait
  batcher used to coalesce watchlist membership writes and per-card season
  detail fetches.

Layering rule: `src/lib/` never imports from `src/hooks/`. Pure data-layer
modules (journal, op builders, query hooks) live under `lib/data/`, state
lives under `stores/`, and only genuine React hooks live in `hooks/`.

### 3.7 UI components & theming

- `src/components/ui/`, **coss ui** primitives built on Base UI
  (`@base-ui/react`): button, dialog, menu, tabs, select, sheet, toast,
  feedback, pagination, etc., plus app-specific primitives (`image`,
  `media-grid`, `lazy-section`, `auto-scroll-title`, `search-bar`, the
  hand-rolled lucide-compatible `icons`). Feature-level components don't
  live here (e.g. `media-skeleton-list` sits at the components root).
- **Theming** is light/dark/system. A tiny inline script in `__root.tsx`
  resolves the stored preference _before first paint_ (no flash of the wrong
  palette); `src/hooks/use-theme.ts` owns the preference (Zustand +
  localStorage) and applies it to `<html>`. Switching themes uses a short
  View Transitions crossfade when the browser supports it.
- Toasts are fire-and-forget: any module can call `toast()` from
  `use-toast-store.ts` (backed by Base UI's toast manager); no provider
  plumbing needed at call sites.
- **Shared page bodies** keep the movie/TV twins thin:
  - `src/components/media/media-detail-page.tsx`, the full detail-page layout
    shared by both index routes (kind-specific bits like certification,
    runtime, keyword mapping stay in the route files as `aboveMedia`/
    `belowMedia` slots).
  - `src/components/media/basic-media-pages.tsx`, `MediaGalleryPage` +
    `MediaCreditsPage` presentational bodies for the four media/cast-crew
    subpages (canonical redirect + guards included).
  - `src/components/media/media-thumb-rail.tsx`, generic thumbnail rail that
    deep-links into the lightbox via URL search params (used by posters,
    videos, backdrops rails).
  - `src/components/paged-media-grid.tsx`, paginated grid wrapper with
    skeleton/empty/error states (list + keyword pages).
  - `src/components/watchlist/watchlist-tab.tsx` + `my-lists-tab.tsx`, the
    two tabs of the watchlist page; `media-row-card-shell.tsx` shares the
    row-card chrome and status/reaction pills between watchlist and
    collection cards.
- `src/components/watchlist/` (grid, filters, custom-list cards, public
  collection page), `src/components/recommendations/`,
  `src/components/admin/`, feature-specific surfaces.
- `src/components/media-card.tsx`, `homepage-media.tsx`,
  `homepage-recommendations.tsx`, `daily-pick.tsx`, `video-player-modal.tsx`,
  `navigation-progress-bar.tsx`, cross-cutting discovery widgets.

## 4. Request flows

### 4.1 Read a media detail page (SSR + client)

1. Browser requests `/movie/123/some-slug`. The Worker (Nitro) streams the SSR
   HTML; TanStack Start runs the route loader built by `indexRouteOptions`.
2. The loader calls `loadMediaRouteData` → `ensureMediaDetails`, which awaits
   `queryClient.ensureQueryData` for the full TMDB detail payload, so the
   query is serialized into the HTML payload and og:image renders a real
   poster path.
3. On the client, TanStack Query hydrates the cache; `useQuery` returns the
   cached data with zero extra requests.
4. The watchlist button derives per-item state from the shared
   `watchlist.list` query (one server fetch for the whole watchlist): each
   card reads its membership/progress/reaction out of that cached list
   instead of issuing a per-media RPC.

### 4.2 Mutate (toggle watchlist membership, signed in)

1. User clicks the watchlist button → `useWatchlistToggle` → `repository.toggleMembership()`.
2. `createRemoteRepository` begins an optimistic op (`beginMembershipOp`),
   which immediately patches `watchlist.list` in the query cache
   (instant UI).
3. The write is queued in `watchlistMembershipBatcher` (300 ms debounce /
   1.2 s max wait / dedupe by `mediaType:tmdbId`), then sent as
   `setWatchlistMembership` (single) or `batchSetWatchlistMembership` (many)
   server fn.
4. On success the server returns the authoritative row; `applyServerState`
   merges it into the cache and the op is resolved (folded into the journal
   base). On failure the op is removed and the cache is rebuilt from base +
   remaining ops.
5. `scheduleSync` debounce-invalidates related keys so derived queries
   (e.g. tracked TMDB ids) refresh once.

### 4.3 Signed-out flow

The same button calls the _local_ repository: `useWatchlistStore`
(Zustand in `src/stores/`, persisted to localStorage with an LRU eviction
wrapper). Guest data never leaves the browser: when the user later signs in,
`UserSync` (`src/components/user-sync.tsx`) only upserts their Clerk profile
via `storeUser`; on sign-out it clears pending optimistic ops so nothing
leaks into the next session.

### 4.4 Open a shared collection page (`/c/$id`)

1. A visitor opens `/c/<list-id>/some-name`. The route loader calls
   `getCollectionPage` through `ensureQueryData`, so the payload is
   serialized into the SSR HTML.
2. The server fn (an `authedFn` in `"anonymous"` mode) resolves the viewer:
   the **owner** gets the full enriched payload (edit/reorder/clone controls
   render); anyone else gets a sanitized public payload. Private and missing
   lists both return `NOT_FOUND` (no existence leak), and owner-only fields
   (`progressStatus`, `reaction`) never reach visitors.

## 5. Deployment & CI/CD

- **Production build**: `vite build` → Nitro `cloudflare_module` preset →
  `.output/server/index.mjs` + `.output/public`.
- **Deploy**: `wrangler deploy` (or GitHub Actions, see below). `wrangler.toml`
  defines the `DB` D1 binding, the `ASSETS` binding, and the cron trigger.
- **Three GitHub Actions workflows** (`.github/workflows/`):
  - `ci.yml` runs on PRs targeting `cloudflare`: install → typecheck → lint →
    build (with build-time `VITE_*` vars only; no Cloudflare secrets).
  - `deploy.yml` runs on push to `cloudflare`: typecheck → lint → apply D1
    migrations (prod) → build with `VITE_*` secrets → `wrangler deploy`.
    Gated to the repo owner's pushes; concurrency serializes prod jobs.
  - `preview.yml` runs on push to any `cf-*` branch: same skeleton but deploys
    a **separate preview Worker** using `wrangler.preview.toml` and a separate
    `pebbly-preview` D1 database. The preview Worker sets `APP_ENV=preview`
    (surfaced by `isPreview()` in `src/server/env.ts`) and runs no cron.
    All actions are pinned to node24-compatible SHAs (checkout v7,
    setup-node v7, pnpm/action-setup v6, wrangler-action v4).
- **Preview config notes**: `wrangler.preview.toml` uses `no_bundle = true`
  plus ESModule rules because Nitro pre-bundles the output, and it must be
  passed via `--config` (never `--env`, which Nitro's redirected config
  breaks). Secrets are set per-Worker with `wrangler secret put`.
- **Cron**: Cloudflare Cron Trigger `0 3 * * *` (production only) → Nitro
  task `snapshots` (`server/tasks/snapshots.ts`) → `createDailySnapshots`,
  bounded per run and resumable via a persisted cursor in
  `snapshot_cursors`.

## 6. Key invariants / rules of the codebase

1. **D1 is the single source of truth** for user data. No second database, no
   Convex remnants.
2. **Admin status is never stored.** `users` has no `is_admin` column (it was
   deliberately removed); admin comes from Clerk public metadata (JWT claim or
   live API).
3. **Every server fn input is Valibot-validated**, every output is a typed
   `ApiResult`, and every protected fn runs through one guard builder
   (`authedFn` in `src/server/fns/rpc.ts`).
4. **Every mutation is optimistic** and goes through the pending-op journal.
   Server snapshots are _replayed_ through pending ops, never applied raw.
5. **Client and server share schema enums** defined once in
   `src/server/schema/common.ts`: the `PROGRESS_STATUSES` / `REACTIONS`
   arrays feed the Valibot picklists, the runtime validation Sets in the
   server helpers, _and_ the Drizzle column enums. One edit changes all three.
6. **D1 batches are bounded** (≤100 statements) and chunked for large imports
   so calls stay inside the Worker execution budget.
7. **Guest data is local-only** (Zustand + localStorage) and stays local;
   signing in switches writes to the remote repository but uploads nothing.
8. **Theme is resolved before first paint** by an inline script; components
   must not branch on theme state during render (drive icon visibility via
   `dark:` CSS variants) so SSR markup and hydration always agree.
9. **Layering:** `src/lib/` does not import from `src/hooks/`; Zustand stores
   live in `src/stores/`; prompt building lives server-side
   (`src/server/prompts.ts`).
