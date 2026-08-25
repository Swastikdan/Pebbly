# Pebbly Backend & Review Fix Plan

Created: 2026-08-25 · Implemented: 2026-08-25
Source: backend architecture review + post-refactor code review findings.
Scope: backend first; frontend flags recorded at the bottom, not scheduled.

Verification for every change: `pnpm typecheck` && `pnpm lint` && `pnpm test`.

Status legend: `[x]` done · `[~]` partial · `[ ]` todo

---

## P0 — One-line correctness fixes

### [x] 1. Race in `appendToPicksList` — missing `.onConflictDoNothing()`

- **Where:** Picks-list item insert (now `src/server/services/picks-list.ts`)
- **Fix applied:** `.onConflictDoNothing()` on the insert; unique index makes a
  concurrent like's insert a no-op instead of failing after the watch-item
  upsert/rev bump committed.

---

## P1 — High-impact backend fixes

### [x] 2. Clerk API call removed from the auth hot path

- **Was:** uncached external Clerk API call per authenticated request inside
  `hasFeature`, `getUserFeatures`, and the `authedFn` admin gate whenever the
  JWT lacked the admin claim.
- **Now:** request-path admin decisions come solely from the signed JWT claim
  (`isAdminByClaims`). `isAdminFromClerkApi` deleted; `getClerkAdminIds`
  remains for the display-only admin user table.
- **⚠️ Manual deployment prerequisite:** configure the Clerk Dashboard
  **session-claims template** to embed `isAdmin: publicMetadata.isAdmin`.
  Until that is configured, admin users will get 403s from admin-gated fns.
  Docs updated (architecture-decisions.md, server-layer.md, file-reference.md).

### [x] 3. Unified rate limiting + homepage TOCTOU race fixed

- **New primitive:** `src/server/helpers/rate-limit.ts`
  (`tryConsumeRateLimit` / `releaseRateLimit`) over a dedicated
  `rate_limit_attempts` ledger table — atomic slot claim, stale-row pruning.
- **generateRecommendations** uses key `ai-gen`; failed AI calls release the
  slot (failures don't burn the window), as before.
- **generateHomepageRecommendations** now uses the same primitive (key
  `ai-homepage`) — concurrent triggers can no longer double-fire Gemini calls.
- **Deleted:** fake `model:"pending"` cooldown rows,
  `checkAndSetRecommendationCooldown`, `releaseRecommendationCooldown`,
  and the `deleteRecommendation` RATE_LIMITED guard (no longer meaningful).
- **Migration:** `drizzle/0008_*.sql` (also carries #9).

### [x] 4. Legacy duplicate-user merge out of `requireUser()`

- **New:** `src/server/helpers/user-merge.ts` — deterministic
  `pickCanonicalMatch` (pure, probe-free) used by the auth hot path;
  `mergeDuplicateUsers` re-parents watch/episode/feedback/homepage rows from
  duplicates onto the canonical account (dupes starve; never deleted).
- **New task:** `server/tasks/user-maintenance.ts`, scheduled daily 03:30 UTC
  (nitro.config.ts + wrangler.toml crons). Scan is one GROUP BY query — a
  cheap no-op once clean.
- `requireUser` no longer does candidate probing or inline item re-parenting;
  negative user-cache entry is invalidated after first-sign-in creation.

### [x] 5. Watch-item mutations standardized on the race-safe upsert

- `updateProgress` and `markShowEpisodesAndStatus` now route through
  `upsertWatchItem` (conflict-set aware) instead of read-then-plain-insert —
  double-submits merge into the winner's row instead of crashing on
  `watch_items_user_media_uq`. Behavior preserved (status inference, clamps,
  metadata patching).

### [~] 6. Tests

- **Done (tier 1):** vitest 4 wired up (`pnpm test`, `vitest.config.ts` with
  `@` alias). 32 unit tests across:
  - `helpers/watch-item.test.ts` — status/reaction normalization, rating
    clamps + NaN fallbacks in `buildMetadataPatch`, all four
    `planMembershipRemoval` branches.
  - `helpers/paginate.test.ts` — cursor flow, termination, short pages.
  - `helpers/user-merge.test.ts` — canonical pick precedence + determinism.
  - `prompts.test.ts` — JSON contract/stats/exclusions/count in prompts.
  - `lib/text.test.ts` — title keys + hash stability.
- **Remaining (tier 2+):** D1 integration tests under
  `@cloudflare/vitest-pool-workers` (upsert races, import batcher, snapshot
  dedupe, rate-limit ledger against real SQLite); RPC envelope contract tests.

---

## P2 — Structure & hygiene

### [~] 7. God-file split / DI consistency (first tranche)

- `appendToPicksList` extracted → `src/server/services/picks-list.ts`.
- `createCustomListInner` / `toggleListItemInner` now receive `db` instead of
  self-resolving `getDb(getEnv())` — `fns/lists.ts` no longer imports env/db
  resolution.
- recommendations.ts shrank (~890 → ~700 lines) via #3 removals.
- **Remaining:** full services/repositories layering for watchlists & lists
  query ownership.

### [x] 8. Shared keyset pagination helper

- `src/server/helpers/paginate.ts` (`collectAllByKeyset`) replaces the three
  OFFSET loops: `getAllWatchedEpisodes`, `getAllEpisodeProgress`,
  `loadEpisodeRowsByKey`. O(1) per page instead of O(offset).

### [x] 9. DB-level constraints for free-text status columns

- `lists.visibility` CHECK `('public','private')`, `lists.list_type` CHECK
  `('custom','pebbly-picks')`, `homepage_recommendations.status` CHECK
  `('none','success','failed')`; canonical consts exported from
  `schema/lists.ts` / `schema/recommendations.ts` and shared by valibot +
  drizzle. Data-preserving table rebuilds in migration `0008`.

### [~] 10. Minor cleanups

- `getCustomLists` aggregates previews/counters in SQL (group_concat + count)
  instead of loading every list-item row.
- `bumpUserRev` if/else chain → shared SQL descriptor map.
- JWT verify + public_meta parse failures log at warn level (message only,
  never token contents).
- `watchlistHash`: dead computation/plumbing removed. Column retained
  (defaults `""`) deliberately — it is the natural key for future hash-based
  generation cache-skip work.

---

## Deployment notes (in order)

1. Apply migration locally then remotely:
   `pnpm db:migrate:local` → `pnpm db:migrate:prod`
   (creates `rate_limit_attempts`, rebuilds `lists` + `homepage_recommendations`).
2. Configure the Clerk session-claims template (`isAdmin` ←
   `publicMetadata.isAdmin`) **before/with** deploying #2.
3. Deploy. The new `30 3 * * *` cron ships in wrangler.toml.
4. Optional cleanup later: backfill/purge legacy `watchlist_hash` values once
   hash-skip lands or the column is dropped.

---

## Frontend flags (from review — confirm intent, not scheduled)

- **CLS for anonymous users** (`src/routes/index.tsx:156-190`,
  `search-page.tsx:419-430`): signed-out visitors get a 320px ContinueWatchingSection
  placeholder that collapses after Clerk hydration; SearchHistory shows a 48px row for
  users with no history. Commit message suggests deliberate — confirm anonymous case
  was considered.
- **Lightbox images at ORIGINAL quality** (`src/lib/media-transform.ts:91-110`):
  removed warning said originals "can be several MB". Fine if driven by image-quality
  complaints; otherwise re-introduces known payload cost.
- **Dead branches in search filter reset** (`search-page.tsx:107-118`): second/third
  ifs unreachable when first matches. Also Movies/Series buttons hidden based on
  current page composition lose their filter mid-pagination (type on page 2, none on
  page 1).

---

## Verification log (2026-08-25)

- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (32/32)
- `pnpm build` ✅ — `user-maintenance` task present in the Nitro bundle;
  migration `drizzle/0008_*.sql` generated and reviewed.
