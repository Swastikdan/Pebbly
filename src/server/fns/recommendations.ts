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
  buildCandidateRecommendationPrompt,
  buildCustomListPrompt,
  buildGenrePrompt,
  buildHomepageRecommendationsPrompt,
  buildWatchlistPrompt,
} from "@/server/prompts";
import { dedupeRecommendations } from "../ai";
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
import { hasFeature, isAdminByClaims } from "../rbac";
import { getRecommendationCandidates } from "../recommendation-candidates";
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
const GENERATION_RATE_LIMIT_KEY = "ai-gen";
const HOMEPAGE_RATE_LIMIT_KEY = "ai-homepage";
const RECENT_HISTORY_EXCLUSION_ENTRIES = 10;
const MAX_RECENT_EXCLUSION_TITLES = 150;

function balanceHomepageRecommendations(
  recommendations: RecommendationRow[],
): RecommendationRow[] {
  const movies = recommendations.filter((item) => item.mediaType === "movie");
  const shows = recommendations.filter((item) => item.mediaType === "tv");
  const result: RecommendationRow[] = [];
  let movieIndex = 0;
  let showIndex = 0;

  while (
    result.length < 30 &&
    (movieIndex < movies.length || showIndex < shows.length)
  ) {
    if (movieIndex < Math.min(movies.length, 15)) {
      result.push(movies[movieIndex++]);
    }
    if (result.length >= 30) break;
    if (showIndex < Math.min(shows.length, 15)) {
      result.push(shows[showIndex++]);
    }
  }

  return result;
}

async function getRecentRecommendationExclusions(
  db: Db,
  userId: string,
): Promise<{ tmdbIds: number[]; titles: string[] }> {
  const rows = await db
    .select({ recommendations: aiRecommendations.recommendations })
    .from(aiRecommendations)
    .where(eq(aiRecommendations.userId, userId))
    .orderBy(desc(aiRecommendations.createdAt))
    .limit(RECENT_HISTORY_EXCLUSION_ENTRIES);

  const recommendations = rows.flatMap(
    (row) => parseStoredRecommendations(row.recommendations) ?? [],
  );
  const tmdbIds = [
    ...new Set(
      recommendations
        .map((recommendation) => recommendation.tmdbId)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  const titles = [
    ...new Set(
      recommendations
        .map((recommendation) => recommendation.title)
        .filter((title): title is string => !!title),
    ),
  ].slice(0, MAX_RECENT_EXCLUSION_TITLES);

  return { tmdbIds, titles };
}

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

      return ok(
        rows.map((row) => ({
          ...row,
          recommendations:
            parseStoredRecommendations(row.recommendations) ?? [],
        })),
      );
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
          recommendations: dedupeRecommendations(validated.output),
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
    recommendations: dedupeRecommendations(args.recommendations),
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
    recommendations: dedupeRecommendations(recommendations),
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

// --- Synchronous generation ---
//
// The AI call runs inline inside the request. Structured requests complete in
// the low seconds, and an incoming HTTP request stays open while the client is
// connected, so no job table or status polling is needed.

export const startGeneration = createServerFn({ method: "POST" })
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

        const recentExclusions = await getRecentRecommendationExclusions(
          db,
          user.id,
        );
        const excludeTmdbIds = [
          ...new Set([
            ...(data.excludeTmdbIds ?? []),
            ...(feedbackSignals.dislikedTmdbIds ?? []),
            ...recentExclusions.tmdbIds,
          ]),
        ];
        const excludeTitles = [
          ...new Set([
            ...(feedbackSignals.dislikedTitles ?? []),
            ...recentExclusions.titles,
          ]),
        ];
        const generationFeedback = {
          ...feedbackSignals,
          previousTitles: [
            ...(feedbackSignals.previousTitles ?? []),
            ...recentExclusions.titles,
          ],
        };

        const candidateCatalog = await getRecommendationCandidates({
          watchItems: watchlistData.watchItems,
          seedItems:
            genType === "list" && data.listId
              ? watchlistData.listItems
                  .filter((item) => item.listId === data.listId)
                  .map((item) =>
                    item.mediaType === "movie" || item.mediaType === "tv"
                      ? { tmdbId: item.tmdbId, mediaType: item.mediaType }
                      : null,
                  )
                  .filter(
                    (item): item is { tmdbId: number; mediaType: MediaType } =>
                      item !== null,
                  )
              : undefined,
          mediaTypePreference: data.mediaTypePreference,
          excludeTmdbIds,
          excludeTitles,
          yearFrom: data.yearFrom,
          yearTo: data.yearTo,
          limit: 40,
          balanced: true,
        });
        const likedCandidateTitles = [
          ...(feedbackSignals.likedTitles ?? []),
          ...watchlistData.watchItems
            .filter(
              (item) => item.reaction === "loved" || item.reaction === "liked",
            )
            .map((item) => item.title)
            .filter((title): title is string => !!title),
        ];

        const userPrompt = candidateCatalog.length
          ? buildCandidateRecommendationPrompt({
              candidates: candidateCatalog,
              likedTitles: likedCandidateTitles,
              dislikedTitles: feedbackSignals.dislikedTitles ?? [],
              previousTitles: generationFeedback.previousTitles ?? [],
              mediaTypePreference: data.mediaTypePreference,
              genrePreference: data.genrePreference,
              count: Math.min(Math.max(data.count ?? 10, 1), 30),
              goal:
                genType === "list"
                  ? "Prefer candidates that match the themes, genres, cast, creators, and tone of the selected custom list."
                  : "Prefer candidates that match the user's strongest positive viewing signals while keeping the results varied.",
            })
          : genType === "watchlist"
            ? buildWatchlistPrompt(
                watchlistData,
                data.mediaTypePreference,
                excludeTmdbIds,
                data.yearFrom,
                data.yearTo,
                data.count,
                generationFeedback,
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
                  generationFeedback,
                )
              : buildGenrePrompt(
                  watchlistData,
                  data.mediaTypePreference,
                  data.genrePreference,
                  excludeTmdbIds,
                  data.yearFrom,
                  data.yearTo,
                  data.count,
                  generationFeedback,
                );

        const generated = await runAiGeneration({
          prompt: userPrompt,
          attempts: 1,
          watchItems: watchlistData.watchItems,
          excludeTmdbIds,
          excludeTitles,
          candidateCatalog: candidateCatalog.length
            ? candidateCatalog
            : undefined,
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

export const startHomepageGeneration = createServerFn({
  method: "POST",
}).handler(() =>
  authedFn(
    { mode: "require", feature: "ai-recommendations" },
    undefined,
    async ({ claims, db, user }): Promise<ApiResult<GenerateResult>> => {
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
      const recentExclusions = await getRecentRecommendationExclusions(
        db,
        user.id,
      );
      const previousTitles = [
        ...(previous?.map((r) => r.title) ?? []),
        ...recentExclusions.titles,
      ];
      const previousTmdbIds = [
        ...(previous
          ?.map((r) => r.tmdbId)
          .filter((id): id is number => typeof id === "number") ?? []),
        ...recentExclusions.tmdbIds,
      ];

      const combinedExcludeIds = [
        ...new Set([
          ...(feedbackSignals.dislikedTmdbIds ?? []),
          ...previousTmdbIds,
        ]),
      ];
      const combinedExcludeTitles = [
        ...new Set([
          ...(feedbackSignals.dislikedTitles ?? []),
          ...previousTitles,
        ]),
      ];
      const candidateCatalog = await getRecommendationCandidates({
        watchItems: watchlistData.watchItems,
        excludeTmdbIds: combinedExcludeIds,
        excludeTitles: combinedExcludeTitles,
        limit: 60,
        balanced: true,
      });
      const homepagePrompt = candidateCatalog.length
        ? buildCandidateRecommendationPrompt({
            candidates: candidateCatalog,
            likedTitles: feedbackSignals.likedTitles ?? [],
            dislikedTitles: feedbackSignals.dislikedTitles ?? [],
            previousTitles,
            count: 30,
            goal: "Choose a balanced homepage mix with the strongest 15 movie and 15 TV matches when enough candidates exist.",
          })
        : buildHomepageRecommendationsPrompt(
            watchlistData,
            feedbackSignals.likedTitles ?? [],
            feedbackSignals.dislikedTitles ?? [],
            combinedExcludeIds,
            previousTitles,
          );

      // Synchronous in-request generation (see the comment above
      // `startGeneration`).
      const generated = await runAiGeneration({
        prompt: homepagePrompt,
        attempts: 2,
        watchItems: watchlistData.watchItems,
        excludeTmdbIds: combinedExcludeIds,
        excludeTitles: combinedExcludeTitles,
        candidateCatalog: candidateCatalog.length
          ? candidateCatalog
          : undefined,
      });
      if (!generated.ok) {
        if (rateLimitToken) await releaseRateLimit(db, rateLimitToken);
        await saveHomepageFailure(db, user.id);
        return ok({ error: generated.error });
      }
      const homepageRecommendations = balanceHomepageRecommendations(
        generated.recommendations,
      );
      if (homepageRecommendations.length === 0) {
        await saveHomepageFailure(db, user.id);
        return ok({ error: "empty_result" });
      }
      await saveHomepageRecommendations(db, user.id, homepageRecommendations);

      return ok({
        recommendations: homepageRecommendations,
        inputStats: watchlistData.inputStats,
        generatedAt: Date.now(),
        cached: false,
      });
    },
  ),
);
