# Server layer

Everything that runs on the Worker (or in Node during `vite dev` SSR). The
server layer is split between **Nitro** (framework-agnostic entry points) and
**TanStack Start server functions** (the application "API").

## 1. Runtime bootstrap

- `nitro.config.ts`, scans `server/` for Nitro routes/tasks, enables the
  experimental task system (used by the Cloudflare cron), maps the `0 3 * * *`
  cron to the `snapshots` task, sets cache-control + security headers via
  `routeRules`, and selects the `cloudflare_module` preset for production
  builds.
- `wrangler.toml`, the Worker definition: entry `.output/server/index.mjs`,
  `ASSETS` binding for static files, `DB` binding for D1, cron trigger, and
  observability config. Secrets are NOT in this file (they go through
  `wrangler secret put`); only non-secret `VITE_*` build-time vars are inlined
  by Vite.
- `wrangler.preview.toml`, the **preview** Worker definition used by
  `preview.yml` on `cf-*` branches: separate `pebbly-preview` D1 database,
  `APP_ENV=preview` var, no cron triggers, and `no_bundle = true` with
  ESModule rules (Nitro pre-bundles the output). It must be passed to
  wrangler via `--config`, never `--env`.
- `server/routes/api/health.ts`, `GET /api/health`: pings D1 with `select 1`,
  returns `{ ok, checks, durationMs }`, `503` when the DB is down. The DB
  check result is memoized for 10 s (failures ~5 s) so an outage doesn't turn
  into a stampede, and the check is skipped entirely when there's no D1
  binding (plain `vite dev`). Never leaks raw driver errors (public endpoint).
- `server/tasks/snapshots.ts`, Nitro task dispatched by the cron. Reads the
  persisted cursor (`snapshot_cursors`), calls `createDailySnapshots` (max 200
  users/run, keyset pagination), persists the new cursor, and returns a
  summary.

## 2. Environment (`src/server/env.ts`)

- `Env` interface mirrors the Worker bindings (`DB`, `ASSETS`,
  `CLERK_SECRET_KEY`, `CLERK_ISSUER_URL`, `GEMINI_API_KEY`, `APP_ENV`).
- `getEnv()` reads `globalThis.__env__` (set by Nitro on the Worker) with a
  `process.env` fallback for Node dev.
- `validateEnv()` runs once per isolate/process and validates string vars with
  Valibot. A missing `CLERK_SECRET_KEY` is a loud `console.error` (it silently
  degrades everyone to guest), while a missing `GEMINI_API_KEY` is a warning.
- `isPreview()` / `isProduction()` read the optional `APP_ENV` var (the
  preview Worker sets `APP_ENV=preview`) for environment-specific behavior.
- The `DB` binding is validated separately in `getDb` with an actionable error
  (explains that `pnpm dev:web` is UI-only and `pnpm dev:cf` is needed for D1).

## 3. Database access (`src/server/db/`)

- `client.ts`, `getDb(env)` lazily creates and caches a Drizzle D1 instance
  per binding (WeakMap). D1 is serverless, so there is no pool; caching avoids
  re-processing the schema on every request. `runBatch(db, statements)` guards
  the empty case and casts the dynamic array for Drizzle's tuple-typed
  `db.batch`.
- `schema.ts`, the complete Drizzle schema (see [data-model.md](./data-model.md)).
- `helpers/watch-item.ts`, shared watch-item logic: `getWatchItem`,
  `normalizeProgressStatus` / `normalizeReaction` (safe guards against invalid
  legacy values), `buildMetadataPatch` (clamps rating 0–10),
  `planMembershipRemoval` (the single decision for "what happens when a title
  leaves the watchlist": rows with a reaction or real progress survive as
  detached rows with `in_watchlist: false`, bare rows are deleted, and a
  leftover `watch-later` status is cleared), and `upsertWatchItem`
  (insert-or-patch on the `(user, tmdb, mediaType)` unique key, with
  `onConflictDoUpdate` so a concurrent duplicate insert applies this
  request's state to the winner's row instead of silently dropping it). Also
  `bumpUserRev` + the `bumpWatchlistRev` / `bumpListsRev` / `bumpAiRev` /
  `bumpPermsRev` wrappers, atomic increments of the per-user revision counters
  that drive cross-device change detection (see ADR-015).
- `helpers/episode-sync.ts`, everything episode-progress writes share:
  `buildEpisodeSyncStatements` (update only when watched-state actually
  changed; insert-on-watch with `onConflictDoNothing`),
  `loadEpisodeRowsByKey` (offset pagination in pages of 500), and
  `syncEpisodeProgressRecord` (one read + one batch + rev bump). The
  watchlist fns call into this so a whole-show sync is never N round trips.
- `helpers/snapshots.ts`, `createWatchlistSnapshot` (records the current
  watchlist media ids unless identical to the latest snapshot; deterministic
  ordering before the 500-row limit) and `createDailySnapshots` (keyset
  pagination over users, bounded per run, resumable via cursor).

## 4. Auth (`src/server/auth.ts`)

- `getSessionToken()`, prefers `Authorization: Bearer`, falls back to the
  `__session` / `__clerk_db_jwt` cookies.
- `getSessionClaims()`, verifies the JWT with `@clerk/backend` (10 s clock
  skew tolerance); malformed/expired → `null` (guest).
- `requireUser()`, the main auth gate. Verifies the session, resolves the
  user, **creates the row on first sign-in** (race-safe:
  `onConflictDoNothing` + re-read by canonical `tokenIdentifier`), and
  auto-consolidates orphaned `watch_items` from duplicate legacy user rows
  (batched rewrite).
- `getCurrentUser()`, resolves without creating (read paths).
- `findUserByClaims()`, multi-format `tokenIdentifier` matching (canonical
  `clerk|<sub>` fast path via the unique index, then a LIKE fallback for
  legacy `*|<sub>` formats), with a short-lived in-memory cache (15 s TTL,
  500-entry LRU) to avoid duplicate DB hits.
- Admin helpers, `getAdminFromClaims` (JWT claim), `isAdminFromClerkApi`
  (live Clerk API, deliberately **uncached** and time-boxed to 5 s, degrades
  to `false`), `getClerkAdminIds` (one paginated user-list call for admin
  table display, display-only, never used for access decisions).

## 5. RBAC (`src/server/rbac.ts`)

- Two dynamic roles (`video-player`, `ai-integrations`) map 1:1 to two
  features (`video-player`, `ai-recommendations`).
- `hasFeature(claims, user, feature)`, the decision function:
  1. no claims → false
  2. banned user → false
  3. admin (JWT claim or Clerk API) → true
  4. `global:<feature>` permission row must be enabled (default true)
  5. any of the user's roles grant the feature (permission row overrides
     `DEFAULT_PERMISSIONS`)
- `getUserFeatures()`, shape used by the client (`usePermissions`).
- `syncRolePermissions(db, force)`, prunes invalid rows and seeds defaults in
  a single batched round trip (idempotent, race-safe with
  `onConflictDoNothing`).
- **Change propagation**: role changes and bans bump the target user's
  `perms_rev`; a global feature-flag toggle bumps `perms_rev` for *every*
  user. Clients see the change on their next version poll (see ADR-015) —
  there is no separate permissions poll anymore.

## 6. Server functions (`src/server/fns/`)

All fns return `ApiResult<T>` and validate input with Valibot.

### watchlist.ts
- Reads: `getWatchlist` (status-filtered, max 500), `getTrackedTmdbIds`,
  `getMediaState` (single row for a media id), `getAllWatchedEpisodes`,
  `getAllEpisodeProgress`, and `getDataVersion` (1-row read returning the
  user's `watchlistRev` / `listsRev` / `aiRev` / `permsRev`, polled by
  clients for cross-device change detection, see ADR-015).
- Writes: `setWatchlistMembership` / `batchSetWatchlistMembership` (removing
  from the watchlist follows `planMembershipRemoval`: keep the row detached
  when it has a reaction or real progress, else delete it; batch path does
  one read + one `db.batch`, ≤100 items, deduped with latest-wins),
  `setProgressStatus`, `setReaction`, `updateProgress` (infers status from
  the value: ≥95 → done, >0 → watching; an explicit `isWatched: true` forces
  done; always attaches the title to the watchlist),
  `removeFromContinueWatching` (clears status + progress so a title stops
  appearing in continue-watching). **Every write also bumps the user's
  `watchlist_rev`** so other devices pick up the change via their version
  poll.
- Episode progress: `markEpisodeWatched`, `markSeasonEpisodesWatched`
  (≤5,000 episodes), `markShowEpisodesAndStatus` (≤100 seasons × ≤5,000
  episodes each, supports `clearAllEpisodes` to unwatch an entire show),
  all delegating statement building to `helpers/episode-sync.ts` against a
  preloaded row map so a whole show sync is one read + one batch. Each also
  bumps `watchlist_rev`.

### lists.ts
- Reads: `getCustomLists` (with preview images + item counts),
  `getListItems` (owner-only, enriched with watch-item metadata; TMDB-id
  `IN` clauses are chunked at 90 ids because D1 caps bound parameters at
  100), `getItemLists`, and `getCollectionPage` — the payload behind the
  public `/c/$id` pages. `getCollectionPage` resolves the viewer per
  request: the owner gets the full editable payload, visitors get a
  sanitized public one; private and missing lists both return `NOT_FOUND`
  (no existence leak), and owner-only fields (`progressStatus`, `reaction`)
  never reach visitors.
- Writes: `createCustomList` (name 1–50 chars, optional description ≤150,
  hex color, `public`/`private` visibility, `custom`/`pebbly-picks` type,
  `unordered`/`ordered` sort type; duplicate names are guarded by the
  `(user_id, name)` unique index via `onConflictDoNothing` → `CONFLICT`),
  `createCustomListAndAddItem` (rolls back the list if the item insert
  fails), `updateCustomList` (ownership + duplicate-name checks),
  `deleteCustomList` (FK cascade removes children), `toggleListItem`
  (appends at `max(position) + 1` so ordered lists keep their rank),
  `reorderListItems` (≤1,000 items, one UPDATE per item, chunked at 80
  statements), `cloneCustomList` (own lists always cloneable, foreign ones
  only when public; the clone lands private/custom under a name that walks
  `"(copy)"`, `"(copy 2)"`…; items insert in chunks of 80). Every write
  bumps the user's `lists_rev`.

### import-export.ts
- `importWatchlist`, bulk import of `watch_items` + `episode_progress`
  (caps: 5,000 items, 50,000 watched episodes, strings ≤500 chars).
  Dedupes by `(mediaType, tmdbId)`, normalizes statuses/reactions, and
  executes in bounded batches (≤100 statements per `db.batch`, episode INSERTs
  chunked at 14 rows to respect the 100-parameter limit). Ends with a
  watchlist snapshot and a single `watchlist_rev` bump.

### recommendations.ts
- Access/history: `getUserRecommendationAccess`, `getRecommendationHistory`
  (last 20), `deleteRecommendation` (blocked inside the 2-minute rate window
  so users can't erase the cooldown marker), `updateVerifiedRecommendations`.
- Feedback: `getRecommendationFeedback` (last 100), `setRecommendationFeedback`
  (accepts `like` or `not_interested`; a `like` auto-adds the title to the
  watchlist with the `recommended` reaction and to the "Pebbly Picks" list,
  bumping `watchlist_rev` **and** `lists_rev`), `removeRecommendationFeedback`.
- History writes (`saveRecommendations`, `deleteRecommendation`,
  `updateVerifiedRecommendations`) bump the user's `ai_rev`.
- Homepage: `getHomepageRecommendations` (filters out disliked/not-interested
  feedback, computes `needsRefresh` from server time, 24 h cadence, retry
  after 1 h on failure), `generateHomepageRecommendations`.
- Generation: `generateRecommendations`, auth + feature gate, empty-input
  guard, atomic cooldown reservation
  (`checkAndSetRecommendationCooldown`, a reserved `ai_recommendations` row
  that doubles as the rate-limit marker; released on failure),
  `gatherWatchlistData` (one batched read of watch items ≤200, lists ≤50,
  list items ≤200, episode progress ≤200), prompt building (excluded ids
  capped at `MAX_EXCLUDE_TMDB_IDS = 1000`, also enforced client-side),
  `callGeminiAI`, filtering (dedupe against existing ids/titles, drop
  disliked), and persistence (`saveRecommendations` updates the reservation
  row in place so history never shows a placeholder).

### admin.ts
- `requireAdmin()`, `requireUser` + JWT-claim/live-API admin check
  (`FORBIDDEN` otherwise). Never consults a stored flag.
- `getUserFeaturesFn`, `getRolePermissions`, `setRolePermission` (global
  feature toggle via atomic upsert; bumps `perms_rev` for **every** user),
  `setUserRoles` (bumps the target's `perms_rev` + invalidates the server's
  user cache), `setUserBanned` (cannot ban yourself; same rev bump),
  `listUsers` (≤200 rows; admin badges derived from one paginated Clerk
  call; display-only).
- The admin dashboard consumes these through a tabbed UI (Users /
  Permissions) and polls `listUsers` every 10 s while open.

### users.ts
- `storeUser`, upserts identity fields from the verified Clerk session
  (admin is deliberately not part of the payload). `getStatus`, current user
  row or null.

## 7. Gemini AI (`src/server/ai.ts`)

- `callGeminiAI(prompt, systemInstruction, retries)`, the single entry point.
- REST `fetch` to `generateContent` with the key in the `x-goog-api-key`
  header (never the URL), 30 s per-attempt timeout, `responseMimeType: json`.
- Model fallback chain (`MODELS_TO_TRY`) with 1 s backoff between models;
  "high demand" (503) errors are tracked and reported as `high_demand`.
- Response parsing is **validated per element** with Valibot, malformed
  entries are dropped, never trusted as-is.
- `getErrorMessage` / `isHighDemandError` / `delay` are exported for reuse.

## 8. Shared contracts (`src/server/schema/`)

- `common.ts`, the shared enums (`mediaType`, `progressStatus`, `reaction`,
  `feedback`), `metadataSchema`, the `ApiResult<T>` error contract, `ok`/`fail`
  helpers, `ApiError`, and the client-side `unwrap()`.
- `watchlist.ts`, `lists.ts` (incl. visibility/sort-type/description rules and
  the ≤1,000-item reorder cap), `recommendations.ts` (incl.
  `MAX_EXCLUDE_TMDB_IDS = 1000`, year ranges 1900–2100, count 1–30),
  `admin.ts`, and `import.ts` (5,000 items / 50,000 episodes), which hold
  Valibot schemas for every server-fn argument (also imported client-side by
  the fns themselves, since TanStack Start bundles them).
