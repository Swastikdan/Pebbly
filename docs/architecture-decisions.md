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
status is resolved exclusively from the **signed JWT claim**
(`public_meta.isAdmin`, embedded via the Clerk session-claims template). The
former live Clerk API fallback was removed from the request path. An external
call inside every gate check cost latency and Clerk rate-limit budget; access
decisions must stay local to the verified token. The `users.roles` column only carries the two _dynamic_ feature
roles (`video-player`, `ai-integrations`), not admin. `listUsers` derives
admin badges from one paginated Clerk user-list call (display-only).

**Consequences:**

- Authorization stays local to the verified signed JWT claim: no admin gate
  on the request path performs any Clerk API call.
- Demotion is not literally instant: claims are fixed until Clerk reissues
  the session token, so a demotion lands within one short-lived
  session-token lifetime (`verifyToken` enforces `exp`) or immediately when
  the session itself is revoked, bounded by Clerk's token refresh/revocation
  policy, never by a long-lived stored flag.
- The admin table display can briefly disagree with reality if its one
  display-only Clerk API call fails (accepted; it never gates access).

---

## ADR-005: Optimistic updates via a replayable journal scoped to the QueryClient

**Status:** Accepted

**Context:** Naive optimistic updates had a "UI flicker" race: a full-list
refetch computed _before_ a write committed could clobber newer optimistic
state. Rollbacks restored an all-or-nothing array snapshot, wiping concurrent
ops. And the original journal lived in module-level globals, shared across
all SSR requests (a cross-user data leak).

**Decision:** `src/lib/data/pending-ops.ts` implements a **replayable
journal**:

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
server fn, TMDB → client, AI provider → server. Unvalidated data caused crashes
deep in call stacks and made errors unreadable.

**Decision:** Use Valibot (lightweight, tree-shakeable, TS-first) at every
boundary:

- Every server fn has a `.validator(schema)` (input) and returns `ApiResult<T>`
  (output) with a finite error-code set (`UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `RATE_LIMITED`, `CONFLICT`, `BAD_REQUEST`).
- TMDB responses are validated against `src/lib/tmdb-schemas.ts` (~670 lines).
- AI output is validated **per element**, malformed entries are dropped,
  never trusted.
- Domain enums (`progressStatus`, `reaction`, `feedback`, `mediaType`) are
  defined once in `src/server/schema/common.ts`: the `PROGRESS_STATUSES` /
  `REACTIONS` arrays feed the Valibot picklists, the runtime validation Sets
  in the helpers, and the Drizzle column enums alike.

**Consequences:**

- Malformed input fails fast at the boundary with a typed error, not a 500.
- Shared schemas mean client and server can't drift.
- Validation cost is negligible (Valibot is small and lazy by design).

---

## ADR-008: Cloudflare Workers AI for production recommendations

**Status:** Accepted

**Context:** AI recommendations must run reliably inside the Cloudflare Worker.
The production provider must avoid region restrictions, keep credentials out of
client code, support structured JSON, and respond quickly enough for the
synchronous server-function flow.

**Decision:** Use the native Cloudflare Workers AI `AI` binding in production
with `@cf/meta/llama-3.1-8b-instruct-fast` and JSON mode. Keep the existing Gemini
REST client only as an optional local-development fallback when no Workers AI
binding is available. Validate every generated recommendation with Valibot
before it reaches filtering or persistence.

**Consequences:**

- Deployed Workers do not depend on Gemini API regional availability.
- The provider requires no separate API key in the Worker; access is through
  the configured Cloudflare binding.
- The free Workers plan includes a daily Workers AI allocation, subject to
  Cloudflare's current quotas and model availability.
- Local Vite development can still use Gemini with `GEMINI_API_KEY`.

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

**Decision:** Guest state lives in persisted Zustand stores (`src/stores/`)
backed by localStorage with an LRU eviction wrapper (`createLRUStorage`, 4 MB
threshold). The repository's local implementation writes to these stores.
`UserSync` (`src/components/user-sync.tsx`) upserts the Clerk profile and
clears the pending-op journal on sign-out; uploading guest data is an explicit
action via `use-watchlist-import-export.ts` (the same server `importWatchlist`
path), never an automatic side effect of signing in.

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
- missing `GEMINI_API_KEY` → warning only when the Workers AI binding is absent (feature-gated degradation),
- missing D1 binding → fail-fast in `getDb` with a message explaining that
  `pnpm dev:web` is UI-only and `pnpm dev:cf` provides D1 + secrets.

**Consequences:**

- Misconfiguration is reported at the surface with a fix hint.
- Validation runs once (memoized) so it costs nothing per request.

---

## ADR-013: Client-side TMDB verification of AI-suggested titles

**Status:** Accepted

**Context:** AI models can hallucinate titles or return near-misses. Showing an
invented poster/title is worse than not showing the pick at all.

**Decision:** AI suggestions are verified against TMDB before rendering
(`src/hooks/use-tmdb-verification.ts` + `use-resolved-recommendation.ts`):
first a direct fetch by the suggested `tmdbId`; if that fails or is missing,
a search fallback with normalized title matching (`titlesMatch`). Verified
results are cached (48 h staleTime) and can be persisted back via
`updateVerifiedRecommendations`. Unverifiable titles render as text-only or
are dropped.

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

- Each `users` row carries four monotonic revision counters
  (`watchlist_rev`, `lists_rev`, `ai_rev`, migrations `0004`/`0005`;
  `perms_rev`, migration `0006`), bumped atomically by every relevant write
  via `bumpUserRev`/`bumpWatchlistRev`/`bumpListsRev`/`bumpAiRev`/
  `bumpPermsRev` (`src/server/helpers/watch-item.ts`). `permsRev` covers RBAC
  state: role/ban changes bump the target user, global feature-flag toggles
  bump every user.
- `getDataVersion` (`src/server/fns/watchlist.ts`) reads all four counters
  in one row.
- `UserSync` (`src/components/user-sync.tsx`) polls `data.version` on an
  adaptive cadence (pauses on hidden tabs): a 4 s fast lane for ~20 s after
  own mutations, 10 s during an active session, 30 s when quiet, and 60 s
  backoff after repeated poll failures. It refetches on window focus
  (covers visibilitychange) and invalidates a query group only when its
  revision moved **beyond what this client's own mutations can explain**.
  Own successful writes are counted per domain in
  `src/lib/realtime-mutations.ts`, instrumented at every rev-bumping call
  site (repository, watch-progress, player listener, import, AI hooks).
  Full-list fetches remain capped at 500 rows.
- Same-browser sibling tabs sync instantly via BroadcastChannel
  (`src/lib/cross-tab-sync.ts`): each own mutation is broadcast and sibling
  tabs invalidate the matching query groups without a server round trip.
- Ban/permission enforcement no longer runs its own fixed poll:
  `use-permissions` refetches on focus and whenever UserSync observes a
  `permsRev` delta, so a banned user is signed out within one adaptive
  interval instead of up to 30 s.

**Consequences:**

- Per-poll cost is O(1) regardless of watchlist/lists/history size; a 50k-item
  user costs the same as a 10-item user. The adaptive cadence cuts steady-state
  reads further (30 s when quiet vs the old fixed 10 s) while feeling faster
  around activity (4 s fast lane, instant on focus).
- Each client refetches at most once per external change; its own writes never
  trigger a redundant refetch. Counters only increment on confirmed successful
  writes, so an uninstrumented path degrades safely to a redundant refetch,
  never a missed external sync. Residual blind spot: another device writing
  exactly as many times as this client within one poll window masks that
  change until the next unexplained delta (documented in
  `realtime-mutations.ts`); same-browser tabs are immune via BroadcastChannel.
- Cross-device latency is one adaptive interval (~4–30 s), instant for
  same-browser tabs and on tab focus. If true push becomes necessary,
  Durable Objects + WebSocket Hibernation (stays ~free at this scale) remains
  the upgrade path.
- Revision counters grow forever but are single integers updated in place: no
  storage accumulation, no realistic overflow.

---

## ADR-016: Public list UUIDs are permanent bearer capabilities

**Status:** Accepted

**Context:** `getCollectionPage` (and the share flow) exposes a custom list
without authentication: anyone holding the `listId` UUID can read the list and
its items. This is a deliberate design (sharing a watchlist by link), not a
leak.

**Decision:** A list's UUID is its capability token. Readers are never
enumerated; the only way to know a list exists is to hold its id. Nothing
identifiable is derivable from the id, and item rows only leave via the public
getters. Do not add an auth wall to the anonymous collection page, and do not
log full collection UUIDs server-side.

**Consequences:**

- A leaked link is a permanent read grant for that list's current contents;
  there is no re-issue mechanism. Revocation = delete the list or (future) a
  "regenerate id" admin action.
- Pagination and item hydration for anonymous readers must stay keyed on the
  id and never accept an out-of-band owner check (an owner check would make
  the seam require auth again).

---

## ADR-017: TMDB token stays client-side; no Worker proxy for anonymous reads

**Status:** Accepted

**Context:** `VITE_PUBLIC_TMDB_ACCESS_TOKEN` ships in the client bundle and the
browser calls TMDB directly for posters/search/browsing; the Worker is not in
that path. Anyone can extract the token and scrape TMDB with it, burning the
app's quota. The hardening plan listed two mitigations: a Cloudflare WAF rule
on the deployed domain, and a long-term "proxy cached TMDB reads through the
Worker so the token never ships."

**Decision:** Do **not** proxy TMDB reads through the Worker in the anonymous /
not-signed-in path. Routing every poster load through the server adds cost,
load, and latency for those users with no benefit to them, and the
non-authenticated browsing path must stay server-free. The worker-side token
is an accepted, bounded exposure: the token is a read-only TMDB access token
(no account-mutating scope), and the primary mitigation is the Cloudflare WAF
rule restricting non-browser UAs/origins on the deployed domain, plus TMDB
quota monitoring. If abuse is ever observed, revisit a cached-proxy for
**signed-in** users only.

**Consequences:**

- Anonymous TMDB reads keep flowing browser → TMDB directly; no code change.
- The token remains extractable; protection is operational (WAF + monitoring),
  not architectural.
- A future cached-proxy is explicitly scoped to authenticated users only, and
  would ship behind a flag before any rollout.

---
