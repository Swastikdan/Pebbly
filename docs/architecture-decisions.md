# Architecture Decision Records (ADRs)

Each ADR captures a significant architectural decision: the context that
motivated it, what was decided, and the consequences (including what it cost).
Statuses: **Accepted** (implemented), **Superseded**.

---

## ADR-001: Convex backend replaced by Cloudflare D1 + Drizzle ORM

**Status:** Accepted (completed 2026-08-16)

**Context:** The app originally ran on Convex (real-time backend) while a
parallel Drizzle/D1 layer was being built for Cloudflare. For a while the
codebase maintained **two complete backends** with duplicated schemas,
prompts, and AI logic. That was a split-brain risk: data written to one was
invisible to the other, and every change had to be made twice.

**Decision:** D1 (SQLite on Cloudflare) via Drizzle ORM is the **single**
backend. The entire `convex/` directory was deleted, `convex` and
`@convex-dev/react-query` were removed from dependencies, and every Convex
action/query was ported to a TanStack Start server function. All Convex env
vars were dropped.

**Consequences:**
- One schema (`src/server/db/schema.ts`), one set of server fns, no more
  duplication.
- Lost Convex's realtime/subscriptions initially; cross-device realtime was
  restored with version-gated polling (see ADR-015), while in-session updates
  stay on explicit TanStack Query invalidation.
- D1 limits shape the code: bounded `db.batch` calls, 100-parameter cap,
  30 s execution budget (see ADR-010).
- Ports were made carefully (comments say "port of convex/...") so behavior
  matched during the transition.

---

## ADR-002: Server functions (createServerFn) as the API layer

**Status:** Accepted

**Context:** The app needed a typed, authenticated API for watchlist, lists,
AI recommendations, and admin operations. Options: a separate REST/HTTP API,
Convex mutations (now gone), or TanStack Start server functions.

**Decision:** Every backend operation is a TanStack Start
`createServerFn({ method: "POST" })` with a Valibot `.validator()` for input
and a typed `ApiResult<T>` return (`{ ok: true, data } | { ok: false, code, message }`).
Client calls them through the generated RPC layer; `unwrap()` throws an
`ApiError` on non-ok so TanStack Query's error path fires.

**Consequences:**
- End-to-end type safety: the client imports the same fns it calls; schemas
  are shared, so a schema change is a compile error on both sides.
- No OpenAPI/REST surface to maintain; Nitro only owns `/api/health` and the
  cron task.
- CSRF protection is needed (server fns accept cookies) and is provided by
  `createCsrfMiddleware` scoped to server fns (`src/start.ts`), plus a fresh
  Bearer token attached client-side.

---

## ADR-003: Repository pattern unifies remote and local mutations

**Status:** Accepted

**Context:** Every mutation previously branched on `if (isSignedIn)`,
duplicating ~20–30 lines per operation: one path called server fns with
optimistic ops, the other wrote to Zustand stores. This was error-prone and
hard to test.

**Decision:** Introduce `src/lib/repository/` with two implementations of a
single `Repository` interface:
- `remote-repository.ts`, server fns + optimistic journal + request batcher,
- `local-repository.ts`, Zustand stores (guest/localStorage),
selected by `useRepository()` based on Clerk auth state. The shared
`resolveProgressStatusAction` keeps the TV-vs-movie progress semantics in one
place.

**Consequences:**
- Mutation hooks are thin (e.g. `use-watchlist.ts` dropped from 868 → 239
  lines); the `isSignedIn` branches are gone.
- New mutation types are added once (interface + two implementations).
- The repository is hook-free and can be unit-tested with a fake QueryClient /
  store.

---

## ADR-004: Admin status comes from Clerk, never from the database

**Status:** Accepted

**Context:** `users` originally had an `is_admin` boolean. It was written once
at account creation and never refreshed, so a user demoted in Clerk kept admin
privileges in the DB **forever**. The code comments call this out as a
privilege-escalation hazard.

**Decision:** Delete the `users.is_admin` column (migration `0003`). Admin
status is resolved from two live sources: the **signed JWT claim**
(`public_meta.isAdmin`, available when a custom session claim is configured)
first, then the **live Clerk API** (`isAdminFromClerkApi`, time-boxed, degrades
to `false`). The `users.roles` column only carries the two *dynamic* feature
roles (`video-player`, `ai-integrations`), not admin. `listUsers` derives
admin badges from one paginated Clerk user-list call (display-only).

**Consequences:**
- A demotion in Clerk takes effect immediately.
- Every admin-gated request pays one extra Clerk API call when the JWT claim
  is absent. Preferring the signed claim limits how often that happens.
- The admin table display can briefly disagree with reality if the Clerk API
  call fails (accepted; it never gates access).

---

## ADR-005: Optimistic updates via a replayable journal scoped to the QueryClient

**Status:** Accepted

**Context:** Naive optimistic updates had a "UI flicker" race: a full-list
refetch computed *before* a write committed could clobber newer optimistic
state. Rollbacks restored an all-or-nothing array snapshot, wiping concurrent
ops. And the original journal lived in module-level globals, shared across
all SSR requests (a cross-user data leak).

**Decision:** `src/hooks/pending-ops.ts` implements a **replayable journal**:
- Every write registers a pure `apply(rows)` patch; the patch is applied
  immediately to the cache.
- Server snapshots (refetches, write responses) are merged by replaying
  still-pending ops **on top** of fresh server data.
- Failure removes only the failed op and rebuilds from base + remaining ops.
- Ops touching the same rows supersede each other (latest intent wins).
- Journal state is stored in a `WeakMap<QueryClient, JournalState>`, never
  module-level, and `beginOp` **throws during SSR**.

**Consequences:**
- No UI flicker, no lost concurrent writes, no cross-request leaks.
- Every mutation must be written as a replayable patch (a discipline that has
  kept the op builders pure and idempotent).
- The journal must be cleared on sign-out (`clearPendingOps`).

---

## ADR-006: Coalesce writes with a generic request batcher

**Status:** Accepted

**Context:** Rapid UI actions (e.g. toggling several titles at once, or a
continue-watching strip of N cards each fetching season details) could fire
N requests to the server/TMDB.

**Decision:** `src/lib/batcher.ts` provides a generic `RequestBatcher`
(debounce window, max-wait, max-batch-size, per-item dedupe where latest
state wins, and flush-on-page-hide so queued writes aren't lost on unload).
It is used for:
- watchlist membership writes → `setWatchlistMembership` /
  `batchSetWatchlistMembership` (300 ms / 1.2 s / dedupe by `mediaType:tmdbId`),
- TV season-detail fetches in media cards (`use-season-details.ts`).

**Consequences:**
- Fewer round trips, D1 batches stay small, TMDB rate limits are respected.
- Dedupe-by-key semantics match the server's own per-item deduplication, so
  client and server agree on "latest intent wins".

---

## ADR-007: Valibot for every boundary; typed error contract everywhere

**Status:** Accepted

**Context:** The app passes untrusted data across three boundaries: browser →
server fn, TMDB → client, Gemini → server. Unvalidated data caused crashes
deep in call stacks and made errors unreadable.

**Decision:** Use Valibot (lightweight, tree-shakeable, TS-first) at every
boundary:
- Every server fn has a `.validator(schema)` (input) and returns `ApiResult<T>`
  (output) with a finite error-code set (`UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `RATE_LIMITED`, `CONFLICT`, `BAD_REQUEST`).
- TMDB responses are validated against `src/lib/tmdb-schemas.ts` (742 lines).
- Gemini output is validated **per element**, malformed entries are dropped,
  never trusted.
- Domain enums (`progressStatus`, `reaction`, `feedback`, `mediaType`) are
  defined once in `src/server/schema/common.ts`.

**Consequences:**
- Malformed input fails fast at the boundary with a typed error, not a 500.
- Shared schemas mean client and server can't drift.
- Validation cost is negligible (Valibot is small and lazy by design).

---

## ADR-008: Gemini over REST with a model fallback chain

**Status:** Accepted

**Context:** AI recommendations need to be reliable on the Workers runtime.
The `@google/genai` SDK was suspected of misbehaving on Workers, and a single
model can be unavailable or "high demand".

**Decision:** Call Gemini's REST API directly (`generateContent`) with:
- the API key in the `x-goog-api-key` header (never the URL),
- a 30 s per-attempt timeout,
- a model fallback chain: `gemini-3.1-flash-lite` → `gemini-2.5-flash` →
  `gemini-2.0-flash` → `gemini-1.5-flash` (1 s backoff between models),
- JSON response mode + per-element Valibot validation,
- retries with 503/"high demand" detection surfaced as `high_demand` errors.

**Consequences:**
- Recommendations survive transient Gemini outages.
- Cost/quality tradeoff: the cheapest fast model is tried first.
- Server-side only: the key never reaches the client.

---

## ADR-009: Denormalized metadata snapshots on user rows

**Status:** Accepted

**Context:** Rendering watchlists and list pages requires title, poster,
rating, release date, and overview for every entry. Joining TMDB for each row
would be slow, rate-limited, and failure-prone.

**Decision:** `watch_items` and `list_items` carry denormalized metadata
(title, image, rating, release_date, overview, backdrop) written at mutation
time from the client payload (or the existing row). TMDB remains the
authoritative source; the snapshots are display copies refreshed on touch.

**Consequences:**
- Watchlist/list pages render with zero TMDB calls.
- Metadata can go slightly stale if TMDB updates a title's poster; accepted
  for this app.
- Import/export and Pebbly Picks re-use the same snapshots, keeping the
  client payloads self-contained.

---

## ADR-010: Work within D1's hard constraints (batching, parameters, budget)

**Status:** Accepted

**Context:** D1 is serverless SQLite with real limits: ~100 bound parameters
per query, 30 s execution budget per call, no long transactions across
isolates. Violating them fails whole operations (e.g. a >100-item `IN` clause
or a >100-statement batch).

**Decision:** Encode the limits in the code:
- `runBatch` + `MAX_STATEMENTS_PER_BATCH = 100` for all multi-statement writes.
- `IN` clauses chunked at 90 ids (`lists.ts`), episode INSERTs chunked at 14
  rows (`import-export.ts`).
- The daily cron processes at most 200 users per run and resumes via a
  persisted keyset cursor (`snapshot_cursors`), so no single invocation
  exceeds the budget while coverage stays eventual and complete.
- Reads are capped (`limit 500`) and ordered deterministically.

**Consequences:**
- Large operations are safe by construction; no "magic number" failures.
- Import of a huge watchlist takes multiple round trips (bounded, atomic per
  batch) instead of one giant transaction.

---

## ADR-011: Guest data is local-first, promoted on sign-in

**Status:** Accepted

**Context:** Signed-out users can still use the watchlist. Their data must
survive reloads and, when they sign in, must not be lost.

**Decision:** Guest state lives in persisted Zustand stores backed by
localStorage with an LRU eviction wrapper (`createLRUStorage`, ~4 MB
threshold). The repository's local implementation writes to these stores.
`UserSync` (`src/components/user-sync.tsx`) exports the local watchlist into
the remote backend at sign-in; sign-out clears the pending-op journal and
switches the repository back to local.

**Consequences:**
- Guests get the full watchlist UX with no backend account.
- localStorage quota is managed (LRU eviction across stores).
- Promotion is a bulk server-fn call (the same `importWatchlist` path), so it
  inherits the batching/chunking guarantees.

---

## ADR-012: Env validation and fail-fast with actionable messages

**Status:** Accepted

**Context:** Missing env vars used to fail deep inside call stacks with
cryptic errors, or silently degrade (a missing `CLERK_SECRET_KEY` turned
everyone into a guest with no warning).

**Decision:** `src/server/env.ts` validates the Worker env once per
isolate/process with a Valibot schema:
- missing `CLERK_SECRET_KEY` → `console.error` (loud; every user degrades to
  guest),
- missing `GEMINI_API_KEY` → warning (feature-gated degradation),
- missing D1 binding → fail-fast in `getDb` with a message explaining that
  `pnpm dev:web` is UI-only and `pnpm dev:cf` provides D1 + secrets.

**Consequences:**
- Misconfiguration is reported at the surface with a fix hint.
- Validation runs once (memoized) so it costs nothing per request.

---

## ADR-013: Client-side TMDB verification of AI-suggested titles

**Status:** Accepted

**Context:** Gemini can hallucinate titles or return near-misses. Showing an
invented poster/title is worse than not showing the pick at all.

**Decision:** AI suggestions are verified against TMDB before rendering
(`src/lib/recommendation-engine.ts`): first a direct fetch by the suggested
`tmdbId`; if that fails or is missing, a search fallback with normalized
title matching (`titlesMatch`). Verified results are cached (48 h staleTime)
and can be persisted back via `updateVerifiedRecommendations`. Unverifiable
titles render as text-only or are dropped.

**Consequences:**
- The UI never fabricates media that doesn't exist.
- Extra TMDB calls on the recs pages, mitigated by 48 h caching and the fact
  that only recs results (≤30 titles) are checked.

---

## ADR-014: GitHub Actions: immutable SHA pins + Node 24 runtimes

**Status:** Accepted (updated 2026-08-16)

**Context:** The deploy workflow pinned old action versions
(checkout v4, setup-node v4, pnpm/action-setup v4, wrangler-action v3) that
target the **Node 20** runner runtime. GitHub deprecated Node 20 on hosted
runners and now forces those actions onto Node 24, producing deprecation
warnings and, eventually, breakage.

**Decision:** Bump every action to the current major that runs on **node24**
and keep the repository's immutable-SHA pinning convention (full commit SHA +
`# vN` comment):
- `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7`
- `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7`
  (keeps `node-version: 22`, the project runtime, with `cache: pnpm`)
- `pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6`
- `cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0 # v4`
  (default wrangler version is now v4, matching the repo's wrangler v4)

The newer checkout/setup-node majors contain breaking changes only around
`pull_request_target` / fork-PR checkout behavior, which this push-triggered
workflow never exercises.

**Consequences:**
- No Node 20 deprecation warnings; the workflow is future-proof against the
  Node 20 removal.
- SHA pinning keeps supply-chain integrity (no mutable tags in CI).
- Action updates now require a deliberate PR (as before).

---

## ADR-015: Version-gated polling for cross-device realtime

**Status:** Accepted

**Context:** Convex provided realtime subscriptions out of the box; after the
migration to Cloudflare Workers + D1 the app had none. Polling whole
collections on a fixed interval is O(collection size) in D1 rows-read and
would blow the free-tier read budget for large watchlists (10k–50k items ≈
millions of rows/day/tab). Managed realtime services (Ably, Pusher, …) add a
paid external dependency and were rejected. Durable Objects + WebSocket
Hibernation is the true instant-push path but is real engineering on the
current Nitro/`cloudflare_module` setup, so it was deferred as the upgrade
path rather than the first step.

**Decision:** Cross-device sync is implemented with **version-gated polling**
(one 10 s poll, 1 row read, O(1) at any collection size):

- Each `users` row carries three monotonic revision counters
  (`watchlist_rev`, `lists_rev`, `ai_rev`, migrations `0004`/`0005`),
  bumped atomically by every relevant write via
  `bumpUserRev`/`bumpWatchlistRev`/`bumpListsRev`/`bumpAiRev`
  (`src/server/helpers/watch-item.ts`).
- `getDataVersion` (`src/server/fns/watchlist.ts`) reads all three counters
  in one row.
- `UserSync` (`src/components/user-sync.tsx`) polls `data.version` every 10 s
  (pauses on hidden tabs) and invalidates a query group only when its
   revision moved **beyond what this client's own mutations can explain**.
   Own successful writes are counted per domain in
  `src/lib/realtime-mutations.ts`, instrumented at every rev-bumping call
  site (repository, watch-progress, player listener, import, AI hooks).
  Full-list fetches remain capped at 500 rows.
- Ban enforcement is a separate 30 s poll of `getUserFeaturesFn`, which makes
  a banned user get signed out within ~30 s instead of only on next load.

**Consequences:**
- Per-poll cost is O(1) regardless of watchlist/lists/history size; a 50k-item
  user costs the same as a 10-item user.
- Each client refetches at most once per external change; its own writes never
  trigger a redundant refetch. Counters only increment on confirmed successful
  writes, so an uninstrumented path degrades safely to a redundant refetch,
  never a missed external sync.
- Latency equals the poll interval (~10 s), not instant push. If instant push
  becomes necessary, Durable Objects + WebSocket Hibernation (stays ~free at
  this scale) is the upgrade path.
- Revision counters grow forever but are single integers updated in place: no
  storage accumulation, no realistic overflow.

---
