import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as v from "valibot";

import type { Db } from "../db/client";
import type { Recommendation as RecommendationRow } from "../db/schema";
import type { ApiResult } from "../schema/common";
import type {
  GenerateResult,
  HomepageRecommendationsResult,
} from "../schema/recommendations";
import type { MediaType } from "@/lib/media-types";
import {
  buildCustomListPrompt,
  buildGenrePrompt,
  buildHomepageRecommendationsPrompt,
  buildWatchlistPrompt,
} from "@/server/prompts";
import {
  aiGenerationJobs,
  aiRecommendations,
  homepageRecommendations,
  recommendationFeedback,
} from "../db/schema";
import { findOwnedRow } from "../helpers/owned-row";
import { releaseRateLimit, tryConsumeRateLimit } from "../helpers/rate-limit";
import {
  bumpAiRev,
  bumpListsRev,
  upsertWatchItem,
} from "../helpers/watch-item";
import { JOB_STALE_MS, markJobFailed } from "../jobs/job-lifecycle";
import { driveAiJob } from "../jobs/run-ai-generation";
import { hasFeature, isAdminByClaims } from "../rbac";
import {
  gatherGenerationInputs,
  parseStoredRecommendations,
  runAiGeneration,
  SYSTEM_INSTRUCTION,
} from "../recommendation-generation";
import { fail, ok } from "../schema/common";
import {
  deleteRecommendationArgsSchema,
  generateRecommendationsArgsSchema,
  getHomepageRecommendationsArgsSchema,
  recommendationsArraySchema,
  removeRecommendationFeedbackArgsSchema,
  setRecommendationFeedbackArgsSchema,
  updateVerifiedRecommendationsArgsSchema,
} from "../schema/recommendations";
import { appendToPicksList } from "../services/picks-list";
import { authedFn } from "./rpc";

const RATE_LIMIT_MS = 2 * 60 * 1000;
const GENERATION_RATE_LIMIT_KEY = "ai-gen";
const HOMEPAGE_RATE_LIMIT_KEY = "ai-homepage";

export const getUserRecommendationAccess = createServerFn({
  method: "POST",
}).handler(() =>
  authedFn(
    {
      mode: "require",
      guest: () => ok({ hasAccess: false, reason: "not_authenticated" }),
    },
    undefined,
    async ({
      claims,
      user,
    }): Promise<
      ApiResult<
        | { hasAccess: true }
        | { hasAccess: false; reason: "not_authenticated" | "feature_disabled" }
      >
    > => {
      const allowed = await hasFeature(claims, user, "ai-recommendations");
      if (!allowed) {
        return ok({ hasAccess: false, reason: "feature_disabled" });
      }
      return ok({ hasAccess: true });
    },
  ),
);

export const getRecommendationHistory = createServerFn({
  method: "POST",
}).handler(() =>
  authedFn(
    {
      mode: "require",
      guest: () => ok([]),
      feature: "ai-recommendations",
      featureDenied: "guest",
    },
    undefined,
    async ({
      db,
      user,
    }): Promise<ApiResult<(typeof aiRecommendations.$inferSelect)[]>> => {
      const rows = await db
        .select()
        .from(aiRecommendations)
        .where(eq(aiRecommendations.userId, user.id))
        .orderBy(desc(aiRecommendations.createdAt))
        .limit(20);

      return ok(rows);
    },
  ),
);

export const deleteRecommendation = createServerFn({ method: "POST" })
  .validator(deleteRecommendationArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const entry = await db
          .select()
          .from(aiRecommendations)
          .where(
            and(
              eq(aiRecommendations.id, data.id),
              eq(aiRecommendations.userId, user.id),
            ),
          )
          .limit(1);
        if (entry.length === 0) return fail("NOT_FOUND", "Not found");

        await db
          .delete(aiRecommendations)
          .where(
            and(
              eq(aiRecommendations.id, data.id),
              eq(aiRecommendations.userId, user.id),
            ),
          );
        await bumpAiRev(db, user.id);
        return ok({ ok: true });
      },
    ),
  );

export const updateVerifiedRecommendations = createServerFn({ method: "POST" })
  .validator(updateVerifiedRecommendationsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        let parsedRecommendations: unknown;
        try {
          parsedRecommendations = JSON.parse(data.recommendations);
        } catch {
          return fail("BAD_REQUEST", "Invalid recommendations payload");
        }
        const validated = v.safeParse(
          recommendationsArraySchema,
          parsedRecommendations,
        );
        if (!validated.success) {
          return fail("BAD_REQUEST", "Invalid recommendations payload");
        }

        const entry = await findOwnedRow(
          db,
          aiRecommendations,
          user.id,
          data.id,
        );
        if (!entry) return fail("NOT_FOUND", "Not found");

        const patch: Partial<typeof aiRecommendations.$inferSelect> = {
          recommendations: validated.output,
          verified: true,
        };
        if (!entry.originalRecommendations) {
          patch.originalRecommendations = entry.recommendations;
        }

        await db
          .update(aiRecommendations)
          .set(patch)
          .where(
            and(
              eq(aiRecommendations.id, data.id),
              eq(aiRecommendations.userId, user.id),
            ),
          );
        await bumpAiRev(db, user.id);
        return ok({ ok: true });
      },
    ),
  );

export const getRecommendationFeedback = createServerFn({
  method: "POST",
}).handler(() =>
  authedFn(
    { mode: "current", guest: () => ok([]) },
    undefined,
    async ({
      db,
      user,
    }): Promise<ApiResult<(typeof recommendationFeedback.$inferSelect)[]>> => {
      const rows = await db
        .select()
        .from(recommendationFeedback)
        .where(eq(recommendationFeedback.userId, user.id))
        .limit(100);

      return ok(rows);
    },
  ),
);

export const setRecommendationFeedback = createServerFn({ method: "POST" })
  .validator(setRecommendationFeedbackArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const now = Date.now();

        const existing = await db
          .select()
          .from(recommendationFeedback)
          .where(
            and(
              eq(recommendationFeedback.userId, user.id),
              eq(recommendationFeedback.tmdbId, data.tmdbId),
              eq(recommendationFeedback.mediaType, data.mediaType),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(recommendationFeedback)
            .set({ feedback: data.feedback, updatedAt: now })
            .where(eq(recommendationFeedback.id, existing[0].id));
        } else {
          await db.insert(recommendationFeedback).values({
            id: crypto.randomUUID(),
            userId: user.id,
            tmdbId: data.tmdbId,
            mediaType: data.mediaType,
            title: data.title,
            feedback: data.feedback,
            updatedAt: now,
          });
        }
        await bumpAiRev(db, user.id);

        if (data.feedback === "like") {
          await upsertWatchItem(
            db,
            user.id,
            data.tmdbId,
            data.mediaType,
            (existing) => {
              if (existing) {
                if (!existing.inWatchlist) {
                  return {
                    inWatchlist: true,
                    progressStatus: "watch-later",
                    progress: 0,
                    reaction: existing.reaction ?? "recommended",
                  };
                }
                return {
                  inWatchlist: true,
                  reaction: existing.reaction ?? "recommended",
                };
              }
              return {
                inWatchlist: true,
                progressStatus: "watch-later",
                reaction: "recommended",
                title: data.title,
                image: data.image,
                rating: data.rating,
                release_date: data.release_date,
                overview: data.overview,
              };
            },
          );

          await appendToPicksList(db, user.id, data);
          await bumpListsRev(db, user.id);
        }

        return ok({ ok: true });
      },
    ),
  );

export const removeRecommendationFeedback = createServerFn({ method: "POST" })
  .validator(removeRecommendationFeedbackArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const existing = await db
          .select()
          .from(recommendationFeedback)
          .where(
            and(
              eq(recommendationFeedback.userId, user.id),
              eq(recommendationFeedback.tmdbId, data.tmdbId),
              eq(recommendationFeedback.mediaType, data.mediaType),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .delete(recommendationFeedback)
            .where(eq(recommendationFeedback.id, existing[0].id));
          await bumpAiRev(db, user.id);
        }

        return ok({ ok: true });
      },
    ),
  );

export const getHomepageRecommendations = createServerFn({ method: "POST" })
  .validator(getHomepageRecommendationsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      {
        mode: "require",
        guest: () =>
          ok({
            recommendations: [],
            lastUpdatedAt: 0,
            lastAttemptedAt: 0,
            status: "none",
            needsRefresh: false,
          }),
      },
      data,
      async ({
        claims,
        db,
        user,
      }): Promise<ApiResult<HomepageRecommendationsResult>> => {
        const featureEnabled = await hasFeature(
          claims,
          user,
          "ai-recommendations",
        );

        const entry = await db
          .select()
          .from(homepageRecommendations)
          .where(eq(homepageRecommendations.userId, user.id))
          .limit(1);

        const excludedFeedback = await db
          .select()
          .from(recommendationFeedback)
          .where(
            and(
              eq(recommendationFeedback.userId, user.id),
              inArray(recommendationFeedback.feedback, [
                "not_interested",
                "dislike",
              ]),
            ),
          );

        const excludedFeedbackIds = new Set(
          excludedFeedback.map((f) => f.tmdbId),
        );

        const row = entry[0];
        const recs =
          parseStoredRecommendations(row?.recommendations)?.filter(
            (r) => r.tmdbId === null || !excludedFeedbackIds.has(r.tmdbId),
          ) ?? [];

        const lastAttemptedAt = row?.lastAttemptedAt ?? 0;
        const lastUpdatedAt = row?.lastUpdatedAt ?? 0;
        const status = row?.status ?? "none";

        const currentTime = Date.now();
        const isOlderThan24Hours =
          currentTime - lastAttemptedAt > 24 * 60 * 60 * 1000;
        const hasFailedRecently =
          status === "failed" &&
          currentTime - lastAttemptedAt < 1 * 60 * 60 * 1000;
        const needsRefresh =
          featureEnabled &&
          (!row || (isOlderThan24Hours && !hasFailedRecently));

        return ok({
          recommendations: recs,
          lastUpdatedAt,
          lastAttemptedAt,
          status,
          needsRefresh,
        });
      },
    ),
  );

// --- Exported helpers for background jobs ---

export type SaveRecommendationsArgs = {
  userId: string;
  recommendations: RecommendationRow[];
  inputStats: {
    movieCount: number;
    tvCount: number;
    episodesWatched: number;
    totalItems: number;
  };
  model: string;
  mediaTypePreference?: MediaType;
  genrePreference?: string;
  generationType?: string;
};

export async function saveRecommendations(
  db: Db,
  args: SaveRecommendationsArgs,
) {
  await db.insert(aiRecommendations).values({
    id: crypto.randomUUID(),
    userId: args.userId,
    recommendations: args.recommendations,
    inputStats: args.inputStats,
    model: args.model,
    mediaTypePreference: args.mediaTypePreference,
    genrePreference: args.genrePreference,
    generationType: args.generationType,
    createdAt: Date.now(),
  });
  await bumpAiRev(db, args.userId);
}

async function upsertHomepageRecommendation(
  db: Db,
  userId: string,
  fields: {
    recommendations?: RecommendationRow[];
    previousRecommendations?: boolean;
    lastUpdatedAt?: number;
    status: "success" | "failed";
  },
) {
  const now = Date.now();
  await db
    .insert(homepageRecommendations)
    .values({
      id: crypto.randomUUID(),
      userId,
      recommendations: fields.recommendations ?? [],
      lastAttemptedAt: now,
      lastUpdatedAt: fields.lastUpdatedAt ?? now,
      status: fields.status,
    })
    .onConflictDoUpdate({
      target: homepageRecommendations.userId,
      set: {
        ...(fields.previousRecommendations
          ? {
              previousRecommendations: sql`${homepageRecommendations.recommendations}`,
            }
          : {}),
        ...(fields.recommendations
          ? { recommendations: fields.recommendations }
          : {}),
        lastAttemptedAt: now,
        ...(fields.lastUpdatedAt !== undefined
          ? { lastUpdatedAt: fields.lastUpdatedAt }
          : {}),
        status: fields.status,
      },
    });
  await bumpAiRev(db, userId);
}

export async function saveHomepageRecommendations(
  db: Db,
  userId: string,
  recommendations: RecommendationRow[],
) {
  return upsertHomepageRecommendation(db, userId, {
    recommendations,
    previousRecommendations: true,
    lastUpdatedAt: Date.now(),
    status: "success",
  });
}

export async function saveHomepageFailure(db: Db, userId: string) {
  return upsertHomepageRecommendation(db, userId, {
    lastUpdatedAt: 0,
    status: "failed",
  });
}

async function getHomepageRecommendationEntry(db: Db, userId: string) {
  const entry = await db
    .select()
    .from(homepageRecommendations)
    .where(eq(homepageRecommendations.userId, userId))
    .limit(1);
  return entry.length > 0 ? entry[0] : null;
}

// --- Async generation (fire-and-forget + client polling) ---

export type GenerationJobStatus =
  | { status: "completed"; recommendations: RecommendationRow[]; model: string }
  | { status: "failed"; error: string }
  | { status: "pending" | "running" };

export const startGeneration = createServerFn({ method: "POST" })
  .validator(generateRecommendationsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", feature: "ai-recommendations" },
      data,
      async ({
        claims,
        db,
        user,
      }): Promise<ApiResult<{ jobId: string } | { error: string }>> => {
        const genType = data.generationType ?? "watchlist";

        if (genType === "list" && !data.listId) {
          return fail("BAD_REQUEST", "listId is required for list generation");
        }

        const existing = await db
          .select({
            id: aiGenerationJobs.id,
            createdAt: aiGenerationJobs.createdAt,
            params: aiGenerationJobs.params,
          })
          .from(aiGenerationJobs)
          .where(
            and(
              eq(aiGenerationJobs.userId, user.id),
              inArray(aiGenerationJobs.status, ["pending", "running"]),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          const staleJob = existing[0];
          if (Date.now() - staleJob.createdAt < JOB_STALE_MS) {
            // Fresh in-flight job: piggyback on it instead of duplicating work.
            return ok({ jobId: staleJob.id });
          }
          // Job from an older runtime that lost it mid-flight (e.g. a Worker
          // terminated during generation). Reap it — releasing its reserved
          // rate-limit slot — and fall through to start a fresh generation.
          await markJobFailed(db, staleJob.id, "superseded");
          const staleToken = staleJob.params?.rateLimitToken;
          if (staleToken) await releaseRateLimit(db, staleToken);
        }

        const { watchlistData, feedbackSignals } = await gatherGenerationInputs(
          db,
          user.id,
          ["not_interested"],
        );

        if (genType === "watchlist" && watchlistData.watchItems.length === 0) {
          return ok({ error: "empty_watchlist" });
        }
        if (genType === "list" && data.listId) {
          if (
            watchlistData.listItems.filter((li) => li.listId === data.listId)
              .length === 0
          ) {
            return ok({ error: "empty_watchlist" });
          }
        }

        const isAdmin = isAdminByClaims(claims);
        let rateLimitToken: string | undefined;
        if (!isAdmin) {
          const { allowed, token } = await tryConsumeRateLimit(
            db,
            `${GENERATION_RATE_LIMIT_KEY}:${user.id}`,
            RATE_LIMIT_MS,
          );
          if (!allowed) {
            return ok({ error: "rate_limited" });
          }
          rateLimitToken = token;
        }

        const excludeTmdbIds = [
          ...new Set([
            ...(data.excludeTmdbIds ?? []),
            ...(feedbackSignals.dislikedTmdbIds ?? []),
          ]),
        ];

        const userPrompt =
          genType === "watchlist"
            ? buildWatchlistPrompt(
                watchlistData,
                data.mediaTypePreference,
                excludeTmdbIds,
                data.yearFrom,
                data.yearTo,
                data.count,
                feedbackSignals,
              )
            : genType === "list" && data.listId
              ? buildCustomListPrompt(
                  watchlistData,
                  data.listId,
                  data.mediaTypePreference,
                  excludeTmdbIds,
                  data.yearFrom,
                  data.yearTo,
                  data.count,
                  feedbackSignals,
                )
              : buildGenrePrompt(
                  watchlistData,
                  data.mediaTypePreference,
                  data.genrePreference,
                  excludeTmdbIds,
                  data.yearFrom,
                  data.yearTo,
                  data.count,
                  feedbackSignals,
                );

        const jobId = crypto.randomUUID();
        const jobParams = {
          prompt: userPrompt,
          systemInstruction: SYSTEM_INSTRUCTION,
          watchItems: watchlistData.watchItems,
          excludeTmdbIds,
          attempts: 1,
          inputStats: watchlistData.inputStats,
          generationType: genType,
          mediaTypePreference: data.mediaTypePreference,
          genrePreference: data.genrePreference,
          rateLimitToken,
        };
        await db.insert(aiGenerationJobs).values({
          id: jobId,
          userId: user.id,
          status: "pending",
          params: jobParams,
          createdAt: Date.now(),
        });

        // No background execution here: the job is picked up and run inside
        // the client's first `getGenerationStatus` poll (see driveAiJob).
        // waitUntil() is unsuitable on Cloudflare Workers, which terminate
        // background tasks ~30s after the response — shorter than a typical
        // AI generation.

        return ok({ jobId });
      },
    ),
  );

export const getGenerationStatus = createServerFn({ method: "POST" })
  .validator(v.object({ jobId: v.string() }))
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<GenerationJobStatus>> => {
        const loadJob = () =>
          db
            .select()
            .from(aiGenerationJobs)
            .where(
              and(
                eq(aiGenerationJobs.id, data.jobId),
                eq(aiGenerationJobs.userId, user.id),
              ),
            )
            .limit(1);

        let [job] = await loadJob();
        if (!job) return fail("NOT_FOUND", "Job not found");

        const toStatus = (
          row: typeof aiGenerationJobs.$inferSelect,
        ): ApiResult<GenerationJobStatus> => {
          if (row.status === "completed") {
            return ok({
              status: "completed",
              recommendations: row.recommendations ?? [],
              model: row.model ?? "",
            });
          }
          if (row.status === "failed") {
            return ok({
              status: "failed",
              error: row.error ?? "unknown_error",
            });
          }
          return ok({ status: row.status });
        };

        if (job.status === "pending" || job.status === "running") {
          if (Date.now() - job.createdAt > JOB_STALE_MS) {
            // Hard self-heal: a job still incomplete after the stale window
            // has lost its executor (worker terminated, crash, deploy).
            // Reap it so clients always converge to a terminal state instead
            // of polling forever.
            await markJobFailed(db, job.id, "generation_timed_out");
            [job] = await loadJob();
            if (!job) return fail("NOT_FOUND", "Job not found");
            return toStatus(job);
          }

          // Poll-driven execution: this request claims the job (atomic
          // conditional UPDATE) and runs the generation inline. The client
          // stays connected, so the request may take up to the job timeout —
          // that is fine on Workers (no wall-clock limit while the client is
          // connected). Losers of the claim just observe `running`.
          await driveAiJob(db, job);

          [job] = await loadJob();
          if (!job) return fail("NOT_FOUND", "Job not found");
        }

        return toStatus(job);
      },
    ),
  );

export const startHomepageGeneration = createServerFn({
  method: "POST",
}).handler(() =>
  authedFn(
    { mode: "require", feature: "ai-recommendations" },
    undefined,
    async ({
      claims,
      db,
      user,
    }): Promise<ApiResult<{ jobId: string } | { error: string }>> => {
      const existing = await db
        .select({
          id: aiGenerationJobs.id,
          createdAt: aiGenerationJobs.createdAt,
          params: aiGenerationJobs.params,
        })
        .from(aiGenerationJobs)
        .where(
          and(
            eq(aiGenerationJobs.userId, user.id),
            inArray(aiGenerationJobs.status, ["pending", "running"]),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        const staleJob = existing[0];
        if (Date.now() - staleJob.createdAt < JOB_STALE_MS) {
          return ok({ jobId: staleJob.id });
        }
        await markJobFailed(db, staleJob.id, "superseded");
        const staleToken = staleJob.params?.rateLimitToken;
        if (staleToken) await releaseRateLimit(db, staleToken);
      }

      const isAdmin = isAdminByClaims(claims);
      let rateLimitToken: string | undefined;
      if (!isAdmin) {
        const { allowed, token } = await tryConsumeRateLimit(
          db,
          `${HOMEPAGE_RATE_LIMIT_KEY}:${user.id}`,
          RATE_LIMIT_MS,
        );
        if (!allowed) {
          return ok({ error: "rate_limited" });
        }
        rateLimitToken = token;
      }

      const { watchlistData, feedbackSignals } = await gatherGenerationInputs(
        db,
        user.id,
        ["not_interested", "dislike"],
      );

      const homepageEntry = await getHomepageRecommendationEntry(db, user.id);
      const previous = parseStoredRecommendations(
        homepageEntry?.recommendations,
      );
      const previousTitles = previous?.map((r) => r.title) ?? [];
      const previousTmdbIds =
        previous
          ?.map((r) => r.tmdbId)
          .filter((id): id is number => typeof id === "number") ?? [];

      const prompt = buildHomepageRecommendationsPrompt(
        watchlistData,
        feedbackSignals.likedTitles ?? [],
        feedbackSignals.dislikedTitles ?? [],
        [...(feedbackSignals.dislikedTmdbIds ?? []), ...previousTmdbIds],
        previousTitles,
      );

      const combinedExcludeIds = [
        ...new Set([
          ...(feedbackSignals.dislikedTmdbIds ?? []),
          ...previousTmdbIds,
        ]),
      ];

      const jobId = crypto.randomUUID();
      const jobParams = {
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        watchItems: watchlistData.watchItems,
        excludeTmdbIds: combinedExcludeIds,
        attempts: 2,
        inputStats: watchlistData.inputStats,
        generationType: "homepage" as const,
        rateLimitToken,
      };
      await db.insert(aiGenerationJobs).values({
        id: jobId,
        userId: user.id,
        status: "pending",
        params: jobParams,
        createdAt: Date.now(),
      });

      // No background execution here: the job is picked up and run inside the
      // client's first `getGenerationStatus` poll (see driveAiJob).

      return ok({ jobId });
    },
  ),
);

// Kept for backwards-compat; new callers should use startGeneration + polling.
export const generateRecommendations = createServerFn({ method: "POST" })
  .validator(generateRecommendationsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", feature: "ai-recommendations" },
      data,
      async ({ claims, db, user }): Promise<ApiResult<GenerateResult>> => {
        const genType = data.generationType ?? "watchlist";

        if (genType === "list" && !data.listId) {
          return fail("BAD_REQUEST", "listId is required for list generation");
        }

        const { watchlistData, feedbackSignals } = await gatherGenerationInputs(
          db,
          user.id,
          ["not_interested"],
        );

        if (genType === "watchlist" && watchlistData.watchItems.length === 0) {
          return ok({ error: "empty_watchlist" });
        }
        if (genType === "list" && data.listId) {
          if (
            watchlistData.listItems.filter((li) => li.listId === data.listId)
              .length === 0
          ) {
            return ok({ error: "empty_watchlist" });
          }
        }

        const isAdmin = isAdminByClaims(claims);
        let rateLimitToken: string | undefined;
        if (!isAdmin) {
          const { allowed, token } = await tryConsumeRateLimit(
            db,
            `${GENERATION_RATE_LIMIT_KEY}:${user.id}`,
            RATE_LIMIT_MS,
          );
          if (!allowed) {
            return ok({ error: "rate_limited" });
          }
          rateLimitToken = token;
        }

        const excludeTmdbIds = [
          ...new Set([
            ...(data.excludeTmdbIds ?? []),
            ...(feedbackSignals.dislikedTmdbIds ?? []),
          ]),
        ];

        const userPrompt =
          genType === "watchlist"
            ? buildWatchlistPrompt(
                watchlistData,
                data.mediaTypePreference,
                excludeTmdbIds,
                data.yearFrom,
                data.yearTo,
                data.count,
                feedbackSignals,
              )
            : genType === "list" && data.listId
              ? buildCustomListPrompt(
                  watchlistData,
                  data.listId,
                  data.mediaTypePreference,
                  excludeTmdbIds,
                  data.yearFrom,
                  data.yearTo,
                  data.count,
                  feedbackSignals,
                )
              : buildGenrePrompt(
                  watchlistData,
                  data.mediaTypePreference,
                  data.genrePreference,
                  excludeTmdbIds,
                  data.yearFrom,
                  data.yearTo,
                  data.count,
                  feedbackSignals,
                );

        const generated = await runAiGeneration({
          prompt: userPrompt,
          attempts: 1,
          watchItems: watchlistData.watchItems,
          excludeTmdbIds,
        });
        if (!generated.ok) {
          if (rateLimitToken) await releaseRateLimit(db, rateLimitToken);
          return ok({ error: generated.error });
        }

        await saveRecommendations(db, {
          userId: user.id,
          recommendations: generated.recommendations,
          inputStats: watchlistData.inputStats,
          model: generated.usedModel,
          mediaTypePreference: data.mediaTypePreference,
          genrePreference: data.genrePreference,
          generationType: genType,
        });

        return ok({
          recommendations: generated.recommendations,
          inputStats: watchlistData.inputStats,
          generatedAt: Date.now(),
          cached: false,
        });
      },
    ),
  );

export const generateHomepageRecommendations = createServerFn({
  method: "POST",
}).handler(() =>
  authedFn(
    { mode: "require", feature: "ai-recommendations" },
    undefined,
    async ({
      claims,
      db,
      user,
    }): Promise<ApiResult<{ success: boolean; error?: string }>> => {
      const isAdmin = isAdminByClaims(claims);
      if (!isAdmin) {
        const { allowed } = await tryConsumeRateLimit(
          db,
          `${HOMEPAGE_RATE_LIMIT_KEY}:${user.id}`,
          RATE_LIMIT_MS,
        );
        if (!allowed) {
          return ok({ success: false, error: "rate_limited" });
        }
      }

      const { watchlistData, feedbackSignals } = await gatherGenerationInputs(
        db,
        user.id,
        ["not_interested", "dislike"],
      );

      const homepageEntry = await getHomepageRecommendationEntry(db, user.id);
      const previous = parseStoredRecommendations(
        homepageEntry?.recommendations,
      );
      const previousTitles = previous?.map((r) => r.title) ?? [];
      const previousTmdbIds =
        previous
          ?.map((r) => r.tmdbId)
          .filter((id): id is number => typeof id === "number") ?? [];

      const prompt = buildHomepageRecommendationsPrompt(
        watchlistData,
        feedbackSignals.likedTitles ?? [],
        feedbackSignals.dislikedTitles ?? [],
        [...(feedbackSignals.dislikedTmdbIds ?? []), ...previousTmdbIds],
        previousTitles,
      );

      const combinedExcludeIds = [
        ...new Set([
          ...(feedbackSignals.dislikedTmdbIds ?? []),
          ...previousTmdbIds,
        ]),
      ];
      const generated = await runAiGeneration({
        prompt,
        attempts: 2,
        watchItems: watchlistData.watchItems,
        excludeTmdbIds: combinedExcludeIds,
      });
      if (!generated.ok) {
        await saveHomepageFailure(db, user.id);
        return ok({ success: false, error: generated.error });
      }

      if (generated.recommendations.length === 0) {
        await saveHomepageFailure(db, user.id);
        return ok({ success: false, error: "empty_result" });
      }

      await saveHomepageRecommendations(db, user.id, generated.recommendations);

      return ok({ success: true });
    },
  ),
);
