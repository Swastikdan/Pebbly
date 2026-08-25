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
import { hasFeature } from "../rbac";
import {
  gatherGenerationInputs,
  parseStoredRecommendations,
  runAiGeneration,
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
/** Ledger keys for the shared rate-limit primitive (helpers/rate-limit.ts). */
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
          // Liking a recommendation re-attaches the title to the watchlist
          // (with the "recommended" reaction) and files it on the user's
          // Pebbly Picks list. upsertWatchItem owns the membership semantics
          // and is race-safe on the (user, tmdb, mediaType) unique key.
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
        // Only request a refresh when the user actually has the feature.
        // Otherwise the client would keep firing generateHomepageRecommendations
        // (which the server rejects with FORBIDDEN) on every refetch, a loop.
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

        // Refresh gating uses server-derived time exclusively; the client-
        // supplied `now` is only used for display-related behavior.
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

type SaveRecommendationsArgs = {
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

async function saveRecommendations(db: Db, args: SaveRecommendationsArgs) {
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

async function saveHomepageRecommendations(
  db: Db,
  userId: string,
  recommendations: RecommendationRow[],
) {
  const now = Date.now();
  // userId-keyed upsert: the previous recommendations are preserved from the
  // existing row (excluded from the conflict set).
  await db
    .insert(homepageRecommendations)
    .values({
      id: crypto.randomUUID(),
      userId,
      recommendations,
      lastAttemptedAt: now,
      lastUpdatedAt: now,
      status: "success",
    })
    .onConflictDoUpdate({
      target: homepageRecommendations.userId,
      set: {
        previousRecommendations: sql`${homepageRecommendations.recommendations}`,
        recommendations,
        lastAttemptedAt: now,
        lastUpdatedAt: now,
        status: "success",
      },
    });
  await bumpAiRev(db, userId);
}

async function saveHomepageFailure(db: Db, userId: string) {
  const now = Date.now();
  await db
    .insert(homepageRecommendations)
    .values({
      id: crypto.randomUUID(),
      userId,
      recommendations: [],
      lastAttemptedAt: now,
      lastUpdatedAt: 0,
      status: "failed",
    })
    .onConflictDoUpdate({
      target: homepageRecommendations.userId,
      set: { lastAttemptedAt: now, status: "failed" },
    });
  await bumpAiRev(db, userId);
}

export const generateRecommendations = createServerFn({ method: "POST" })
  .validator(generateRecommendationsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", feature: "ai-recommendations" },
      data,
      async ({ db, user }): Promise<ApiResult<GenerateResult>> => {
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

        const { allowed, token } = await tryConsumeRateLimit(
          db,
          `${GENERATION_RATE_LIMIT_KEY}:${user.id}`,
          RATE_LIMIT_MS,
        );
        if (!allowed) {
          return ok({ error: "rate_limited" });
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
          // A failed AI call does not burn the cooldown: release the slot so
          // the user can retry immediately.
          await releaseRateLimit(db, token);
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
      db,
      user,
    }): Promise<ApiResult<{ success: boolean; error?: string }>> => {
      // Atomic slot claim (unlike the old read-then-write on
      // lastAttemptedAt, concurrent triggers cannot both pass and double-fire
      // expensive Gemini calls). Both success and failure consume the
      // attempt, matching the previous lastAttemptedAt semantics.
      const { allowed } = await tryConsumeRateLimit(
        db,
        `${HOMEPAGE_RATE_LIMIT_KEY}:${user.id}`,
        RATE_LIMIT_MS,
      );
      if (!allowed) {
        return ok({ success: false, error: "rate_limited" });
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

      // An empty result after filtering is a failed generation, record the
      // failure so refresh logic can retry instead of saving "success".
      if (generated.recommendations.length === 0) {
        await saveHomepageFailure(db, user.id);
        return ok({ success: false, error: "empty_result" });
      }

      await saveHomepageRecommendations(db, user.id, generated.recommendations);

      return ok({ success: true });
    },
  ),
);

/**
 * Retrieves the homepage recommendation entry for a user.
 *
 * @param userId - The user's identifier
 * @returns The user's homepage recommendation entry, or `null` if none exists
 */
async function getHomepageRecommendationEntry(db: Db, userId: string) {
  const entry = await db
    .select()
    .from(homepageRecommendations)
    .where(eq(homepageRecommendations.userId, userId))
    .limit(1);
  return entry.length > 0 ? entry[0] : null;
}
