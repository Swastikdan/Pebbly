import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "drizzle-orm";
import * as v from "valibot";

import type { ApiResult } from "../schema/common";
import type {
  GenerateResult,
  HomepageRecommendationsResult,
} from "../schema/recommendations";
import { dedupeRecommendations } from "../ai";
import {
  aiRecommendations,
  homepageRecommendations,
  recommendationFeedback,
} from "../db/schema";
import { findOwnedRow } from "../helpers/owned-row";
import {
  bumpAiRev,
  bumpListsRev,
  upsertWatchItem,
} from "../helpers/watch-item";
import { hasFeature, isAdminByClaims } from "../rbac";
import { parseStoredRecommendations } from "../recommendation-generation";
import { runPipeline } from "../recommendation-pipeline";
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
import { authedFn, WRITE_RATE_LIMIT } from "./rpc";

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
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
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
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
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
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
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
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
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

// --- Synchronous generation ---
//
// Both generation surfaces use the same pipeline. The only difference is the
// intent passed to it; gathering inputs, exclusions, candidate selection,
// provider calls, rate-limit release, and persistence stay in one place.

export const startGeneration = createServerFn({ method: "POST" })
  .validator(generateRecommendationsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", feature: "ai-recommendations" },
      data,
      async ({ claims, db, user }): Promise<ApiResult<GenerateResult>> =>
        ok(
          await runPipeline(
            { db, userId: user.id, isAdmin: isAdminByClaims(claims) },
            { type: "history", options: data },
          ),
        ),
    ),
  );

export const startHomepageGeneration = createServerFn({
  method: "POST",
}).handler(() =>
  authedFn(
    { mode: "require", feature: "ai-recommendations" },
    undefined,
    async ({ claims, db, user }): Promise<ApiResult<GenerateResult>> =>
      ok(
        await runPipeline(
          { db, userId: user.id, isAdmin: isAdminByClaims(claims) },
          { type: "homepage" },
        ),
      ),
  ),
);
