# Recommendation engine — review, safe fixes, and improvement plans

- **Status:** safe changes and the sequenced recommendations (Plans 1B, 2A, 3A) are implemented and verified.
- **Date:** 2026-10-06
- **Scope:** the AI recommendation engine only (`src/server/recommendation-*`, `src/server/prompts.ts`,
  `src/server/ai.ts`, `src/server/schema/recommendations.ts`, `src/server/fns/recommendations.ts`, plus the
  client hooks/options that build generation input).
- **Out of scope:** watchlist/collection features, unrelated lint debt.

---

## 0. How the engine fits together

```
client (use-recommendations / use-homepage-recommendations / recommendation-options)
  └─ startGeneration | startHomepageGeneration          src/server/fns/recommendations.ts
       └─ runPipeline(intent)                           src/server/recommendation-pipeline.ts
            ├─ gatherGenerationInputs()                 src/server/recommendation-generation.ts
            │    ├─ gatherWatchlistData()   (watch_items keyset, lists, list_items, episode_progress)
            │    ├─ getRecommendationFeedbackInternal()
            │    └─ user_taste_profiles row
            ├─ getRecentRecommendationExclusions()       (last 10 ai_recommendations rows)
            ├─ getRecommendationCandidates()             src/server/recommendation-candidates.ts
            │    ├─ TMDB popular (page 1) / trending_week / seed /recommendations / discover
            │    ├─ exclusion + dedupe by (mediaType, tmdbId)
            │    ├─ scoreCandidate()  → heuristic ranking
            │    └─ interleaveByMediaType() → 40 or 60 candidates
            ├─ rerankCandidatesWithJev()                 src/server/recommendation-rerank.ts + jev-adapter.ts
            ├─ buildCandidateRecommendationPrompt()      src/server/prompts.ts
            ├─ runAiGeneration()                         src/server/recommendation-generation.ts
            │    ├─ generateRecommendations()            src/server/ai.ts  (Workers AI, JSON mode)
            │    ├─ matchRecommendationsToCatalog()      (grounding)
            │    └─ filterKnownRecommendations()
            └─ dedupeRecommendations() + persist → ai_recommendations | homepage_recommendations
```

### Current constants (baseline for the perf discussion)

| Knob                                    | Value                                                                          | Where                                                    |
| :-------------------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------- |
| Candidate limit                         | 40 history / 60 homepage (clamped to ≥20)                                      | `recommendation-candidates.ts`                           |
| Candidate sources                       | popular page 1, trending_week page 1, ≤2 seeds, genre discover                 | `recommendation-candidates.ts`                           |
| `MAX_SEED_TITLES`                       | 2                                                                              | `recommendation-candidates.ts`                           |
| Heuristic weights                       | rating .42, votes .25, popularity .15, freshness .08, source .10               | `recommendation-candidates.ts`                           |
| JEV cap / concurrency / floor / timeout | 12 / 6 / 0.55 / 8 s                                                            | `recommendation-rerank.ts`, `jev-adapter.ts`             |
| JEV blend                               | heuristic 0.4 / JEV 0.6 above the confidence floor                             | `recommendation-rerank.ts`                               |
| LLM                                     | `@cf/meta/llama-3.1-8b-instruct-fast`, 30 s timeout, 2048 max tokens, temp 0.2 | `ai.ts`                                                  |
| LLM attempts                            | 1 (history) / 2 (homepage)                                                     | `recommendation-pipeline.ts`                             |
| Homepage shape                          | 30 total, ≤15 per media type, 24 h cache, 2 min rate limit                     | `recommendation-pipeline.ts`                             |
| TMDB transport                          | edge cache `cf: { cacheTtl: 3600, cacheEverything: true }`                     | `lib/tmdb.ts`                                            |
| Feedback read cap                       | 100 rows per user                                                              | `recommendation-generation.ts`, `fns/recommendations.ts` |

**Latency budget (worst case).** TMDB fan-out is edge-cached for 1 h, so it is usually cheap. The expensive
tail is the AI stage: JEV scores up to 12 candidates at concurrency 6 with an 8 s timeout (≈16 s worst case)
and is awaited **before** the LLM, which then allows 1 × 30 s (history) or 2 × 30 s (homepage).

---

## 1. Completed safe changes

All of these are implemented, tested, and reported as done.

### 1.1 🔴 Critical: homepage generation could hang the request forever

- **File:** `src/server/recommendation-pipeline.ts` → `balanceHomepageRecommendations`.
- **Problem:** the loop guarded on the _uncapped_ list lengths while capping each media type at 15:

  ```ts
  while (
    result.length < 30 &&
    (movieIndex < movies.length || showIndex < shows.length)
  ) {
    if (movieIndex < Math.min(movies.length, 15))
      result.push(movies[movieIndex++]);
    if (result.length >= 30) break;
    if (showIndex < Math.min(shows.length, 15)) result.push(shows[showIndex++]);
  }
  ```

  Once a media type exceeded 15, nothing was pushed and nothing advanced, so the loop never exited.
  Verified with a standalone probe:

  ```
  movies=20 tv=0  -> INFINITE LOOP
  movies=0  tv=20 -> INFINITE LOOP
  movies=16 tv=1  -> INFINITE LOOP
  movies=15 tv=15 -> length 30
  ```

  A movie-heavy user whose generation returned ≥16 movies and ≤1 show would pin the Worker until timeout.

- **Fix:** slice each list to the cap up front and iterate to a computed total; exported for testing.
- **Tests:** `src/server/recommendation-pipeline.test.ts` (new, 10 tests) — every previously-hanging shape,
  strict M/T interleaving at 20/20, per-type order preservation, and the 15/0 case.

### 1.2 Model picks were silently dropped on a small ID mismatch

- **File:** `src/server/recommendation-generation.ts` → new `matchRecommendationsToCatalog`.
- **Problem:** grounding required an exact `(mediaType, tmdbId)` catalog hit. The 8B model regularly echoes a
  correct title with a wrong or missing TMDB id, so valid picks were discarded; matching was also
  `Array.find` per pick — O(candidates × picks).
- **Fix:** two maps (by id, by normalized title within the same media type); id match wins, then an exact
  normalized-title fallback. Emitted `title`/`tmdbId`/`mediaType` always come from the catalog entry, so an
  invented title still cannot survive. Duplicate titles resolve to the best-ranked catalog entry.
- **Tests:** 7 cases in `src/server/recommendation-generation.test.ts`. One of them caught a key-prefix bug in
  the first implementation (the title map was checked with an unprefixed key), which was fixed and re-verified.

### 1.3 The ranking LLM was starved of the signals it needs

- **File:** `src/server/prompts.ts` → `buildCandidateRecommendationPrompt`.
- **Problem:** catalog lines were `- movie:550 | Fight Club | 1999 | rating 8.4/10 | votes 28000`. There were no
  genres and no overview, so the model could not act on `genrePreference`, `dislikedThemes`, or the adventure
  level beyond guessing from a title.
- **Fix:** each line now appends resolved genre names (unknown genre ids dropped) and a newline-flattened,
  140-char overview snippet. Fields are omitted when absent so bare candidates keep the old shape.
- **Tests:** 2 new cases in `src/server/prompts.test.ts` (presence, unknown-id dropping, flattening,
  truncation with ellipsis, and the no-genre/no-overview shape).
- **Caveat:** this changes model input, so its quality effect cannot be measured without an A/B run; token cost
  rises by roughly 40–140 characters per candidate (≤60 candidates).

### 1.4 The 100-row feedback cap took arbitrary order

- **Files:** `src/server/recommendation-generation.ts` (`getRecommendationFeedbackInternal`),
  `src/server/fns/recommendations.ts` (`getRecommendationFeedback`).
- **Problem:** both read `recommendationFeedback` with `LIMIT 100` and no `ORDER BY`, i.e. insertion order. A
  user who accumulated >100 rows could have their most recent likes/dislikes crowded out of the generation
  prompt (and out of the UI's dislike filter).
- **Fix:** both now `ORDER BY updated_at DESC` so the cap keeps the newest signals, deterministically.

### 1.5 Verification (after every edit, including the last repair)

- `pnpm typecheck` — clean.
- `pnpm test` — **227 passed / 35 files** (baseline was 208 / 34; +19 new tests).
- `biome lint` on the 7 files touched by this work — clean.
- ⚠️ `pnpm lint` (repo-wide) fails on `src/components/watchlist/custom-list-media-card.tsx`
  (`a11y/useKeyWithClickEvents`, `<label onClick>` without a keyboard handler). That file was modified at 09:15
  by a concurrent edit that is not part of this work; it needs a keyboard handler or the handler moved onto the
  `<input>`. Left untouched on purpose (in-progress refactor, outside scope).

---

## 2. Findings

| #   | Finding                                                                                                                                                                                                                                          | Severity | Where                                        |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------------------------------------------- |
| 2.1 | **Taste-profile `preferredGenres` / `dislikedGenres` are dead data.** Stored, editable in the dialog, loaded by `gatherGenerationInputs` — then never read by the engine. Only `adventureLevel`, `dislikedThemes`, `avoidTitles` reach a prompt. | High     | `recommendation-generation.ts`, `prompts.ts` |
| 2.2 | `buildWatchlistContext` prioritises categories in fixed order (`loved → watching → done → watchLater → disliked`) and truncates to 50, so a heavy user's `loved` list can crowd out _all_ negative signal (`dropped`/`mixed`/`not-for-me`).      | Medium   | `prompts.ts`                                 |
| 2.3 | `parseScore` in the JEV adapter discards a valid `taste_fit` score when `genre_fit` is missing from the response.                                                                                                                                | Low      | `jev-adapter.ts`                             |
| 2.4 | `buildGenerateOptions` computes `Math.min/max` over matched eras; if no preset label matches, `yearFrom` becomes `Infinity` and the request 400s. Only reachable with stale labels.                                                              | Low      | `recommendation-options.ts`                  |
| 2.5 | Genre `separate` mode fans out to `genreIds × mediaTypes` discover calls (up to 20) in parallel.                                                                                                                                                 | Low/Med  | `recommendation-candidates.ts`               |
| 2.6 | `filterKnownRecommendations` excludes by title across media types, so a movie and a show sharing a name can over-exclude.                                                                                                                        | Low      | `recommendation-generation.ts`               |
| 2.7 | Homepage `inputStats` in the cached response is derived from the recommendations rather than the library. **Deferred:** cosmetic only; fixing it would require an extra library read on the cache-hit path.                                      | Cosmetic | `recommendation-pipeline.ts`                 |

---

## 3. Plans for the larger improvements

Each plan lists variants with pros/cons, concrete implementation steps, performance impact, and tests. All are
**behaviour-changing** (generated output changes), so they need a product decision before implementation.

### Plan 1 — Make the taste profile actually affect recommendations

**Motivation (2.1):** a user who explicitly selects "love Sci-Fi, avoid Horror" currently gets zero effect from
those choices. This is the largest user-visible accuracy gap in the engine.

#### Variant 1A — Prompt-only (smallest possible)

1. Extend `FeedbackSignals` in `prompts.ts` with `preferredGenres?: string[]`, `dislikedGenres?: string[]`.
2. In `gatherGenerationInputs`, put `tasteProfile.preferredGenres` / `dislikedGenres` onto `feedbackSignals`.
3. In `buildCandidateRecommendationPrompt`, add lines when present:
   `Strongly prefer titles in these genres: …` / `Avoid titles in these genres: …`, and the same for
   `buildWatchlistPrompt` / `buildCustomListPrompt` through `buildBasePromptSections`.
4. Tests: extend `prompts.test.ts`.

- **Pros:** ~40 lines; no scoring changes; trivially revertible; easy to unit test.
- **Cons:** depends entirely on the 8B model honouring the instruction; not deterministic; cannot be measured
  except by eyeballing generations.
- **Perf:** negligible (+~60 bytes per prompt).

#### Variant 1B — Deterministic candidate scoring (recommended)

1. Map genre names → TMDB ids once via `GENRE_LIST` (module-level `Map`, as `jev-adapter.ts` does).
2. Add `preferredGenreIds?: number[]` / `dislikedGenreIds?: number[]` to `CandidateGenerationOptions`.
3. Apply the signal in `scoreCandidate` (candidate `genreIds` are already collected):

   ```ts
   const preferredHits = candidate.genreIds.filter((id) =>
     preferred.has(id),
   ).length;
   const dislikedHits = candidate.genreIds.filter((id) =>
     disliked.has(id),
   ).length;
   score += Math.min(preferredHits, 3) * 0.12;
   score -= Math.min(dislikedHits, 3) * 0.15;
   ```

   Suggested weights: +0.12 per preferred hit (cap 3), −0.15 per disliked hit (cap 3) — visible but not
   dominant against the 0.42 rating weight. Optionally hard-drop candidates whose _only_ genres are disliked.

4. Thread the ids from `runHistoryPipeline`/`runHomepagePipeline` (taste profile is already gathered).
5. Also pass the names into the candidate prompt (variant 1A) so the LLM sees the same signal.

- **Pros:** deterministic and explainable; improves the catalog _before_ the LLM ranks it; cheap; unit-testable
  in `recommendation-candidates.test.ts` without any network.
- **Cons:** weights need tuning; risk of over-filtering niche/adjacent genres; a product decision is needed on
  whether it applies in **genre mode** (which currently ignores watchlist personalisation by design).
- **Perf:** pure in-memory over ≤60 candidates; no extra network or AI calls.

#### Variant 1C — 1B + explicit post-filter

Add a phase after `matchRecommendationsToCatalog` that re-ranks or drops picks whose genres conflict with
`dislikedGenres`, plus analytics on how many picks were dropped.

- **Pros:** strongest enforcement; guarantees no disliked-genre title returns.
- **Cons:** most surface area; hardest to attribute regressions; the model may already deprioritise, so this can
  double-penalise and shrink result sets below the requested count.
- **Perf:** in-memory only.

**Recommendation:** 1B (with the prompt text from 1A included so model and heuristic agree).

---

### Plan 2 — Broaden the candidate pool

**Motivation:** the pool is popular page 1 + trending week + ≤2 seeds + genre discover, deduped to 40/60. A pool
this narrow makes repeats likely and under-serves users whose taste is not "currently popular".

#### Variant 2A — More depth, same call patterns

1. Fetch page 2 of each popular/discover source in `getRecommendationCandidates` and merge before dedupe.
2. Raise `MAX_SEED_TITLES` 2 → 4.
3. **Keep** the 40/60 output limit so prompt size and LLM cost are unchanged — only _which_ candidates survive
   changes.
4. Tests: extend `recommendation-candidates.test.ts` (page-2 merge, seed cap, limit still honoured).

- **Pros:** smallest change with real variety gains; TMDB GETs are already edge-cached for 1 h, so extra pages
  are mostly cache hits; no prompt-size change.
- **Cons:** modest ceiling; genre `separate` mode already fans out, so cap the added pages there.
- **Perf:** +0–4 TMDB GETs (usually cache hits), +1–3 ms scoring; prompt bytes unchanged.

#### Variant 2B — Personalised seed expansion

1. Seed from the top-N (4) most recent loved/liked items instead of 2 (and from list items for list generation,
   which already takes priority).
2. Merge each seed's `/recommendations` results into the raw pool.
3. Weight seed-derived candidates slightly above "popular" (the `source` term already exists: `seed: 1.0`,
   `trending: 0.05`, others 0) and keep the cap.
4. Tests: seed selection order, media-type filtering, dedupe precedence (`seed` already wins).

- **Pros:** materially better personalisation, especially for small libraries; uses an endpoint already wired up.
- **Cons:** +2–4 TMDB calls; cold-start users (no reactions) gain nothing; needs weighting so seed results do not
  drown popular picks.
- **Perf:** +2–4 calls, more rows to score (bounded by the 40/60 limit).

#### Variant 2C — Precomputed nightly pools in KV

Cron/task pre-builds per-genre/decade candidate pools into KV; generation reads KV then personalises.

- **Pros:** fastest generation; flat latency; no per-request TMDB fan-out.
- **Cons:** new infrastructure, staleness for new releases, cache invalidation, a new failure mode to monitor.
- **Perf:** removes ~4–24 TMDB GETs per generation; adds one KV read.

**Recommendation:** 2A now; revisit 2C only if generation latency becomes a product problem.

---

### Plan 3 — Two-stage AI latency

**Motivation:** the JEV rerank is awaited serially before the LLM, so it adds its full duration to
time-to-result — up to ~16 s worst case on top of the LLM's 1 × 30 s / 2 × 30 s budget.

#### Variant 3A — Bound JEV harder (safest)

1. `JEV_CANDIDATE_CAP` 12 → 8 and/or `JEV_TIMEOUT_MS` 8 s → 4 s.
2. Or start the JEV batch concurrently with prompt scaffolding, and await it right before `runAiGeneration`.
3. Keep the existing `fallbackReason` analytics to observe the effect.

- **Pros:** 1–2 lines; directly bounds tail latency; the top of the catalog is still reranked.
- **Cons:** fewer scored candidates slightly weakens rerank quality; needs metric-driven tuning.
- **Perf:** rerank worst case ~16 s → 4–8 s; no extra calls.

#### Variant 3B — One batched JEV call

The adapter issues one `ai.run` per candidate although JEV accepts a `questions` object. Batch candidates into
one or two calls.

- **Pros:** ~12 calls → 1–2; large latency and CPU reduction; less rate-limit pressure.
- **Cons:** adapter/prompt and response-parsing rewrite; risk of the model conflating candidates; the rerank
  test suite needs rewriting.
- **Perf:** bounded by a single 8 s timeout instead of two waves.

#### Variant 3C — Async generation with polling

Move generation to a background queue, return a job id, poll.

- **Pros:** removes synchronous request-timeout pressure entirely; enables retries and longer prompts.
- **Cons:** biggest change — queue infrastructure, new UI states, idempotency, cost. It also reverses an explicit
  documented decision ("Generation is fully synchronous", `use-recommendations.ts`) and `ai.ts`'s note that a
  single structured call in the low seconds is what makes synchronous execution viable.
- **Perf:** request latency becomes a poll; total work unchanged.

**Recommendation:** 3A first (cheap, safe), then 3B if rerank quality needs the full candidate set.

---

## 4. Suggested sequencing

1. **Plan 1B** — fixes a real user-visible gap (preferences silently ignored) with no infra work.
2. **Plan 2A** — cheap breadth, improves variety and reduces repeat fatigue.
3. **Plan 3A** — cheap latency bound on the AI tail.
4. Re-evaluate 2C / 3B / 3C only with production metrics (JEV `fallbackReason`, `durationMs`, generation counts)
   in hand.

Items 2.2–2.7 are small enough to fold into whichever plan lands next, or to fix opportunistically.

---

## 5. Test & verification strategy for the proposed work

- **Unit (no network):** candidate scoring weights (preferred/disliked genre boosts), seed selection and caps,
  JEV cap/timeout behaviour via the existing `ai` test seam in `recommendation-rerank.test.ts`, prompt text
  assertions in `prompts.test.ts`.
- **Pure-function extraction first:** keep the pattern used for `balanceHomepageRecommendations` and
  `matchRecommendationsToCatalog` — export the decision function and test it directly, rather than asserting
  through the pipeline.
- **Regression guards:** the hang test must stay; any change to `balanceHomepageRecommendations` must keep the
  `it.each` termination cases green.
- **Not covered here:** end-to-end generation (needs live D1 + TMDB + Workers AI). Quality effects of prompt
  changes cannot be measured without an A/B harness; treat them as hypotheses, not verified improvements.

---

## 6. Repository note

`docs/file-reference.md` describes this directory as:

> `plan/` — Working plans for in-flight refactors. Historical context, not runtime code.

Note that `.gitignore` ignores `/plans` (plural, line 24) as well as `REFACTOR_PLAN.md`; `plan/` (singular) is
tracked. Keep new plans in `plan/` so they are versioned.
