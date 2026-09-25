import { createServerFn } from "@tanstack/react-start";
import { and, eq, lte, sql } from "drizzle-orm";

import type { ApiResult } from "../schema/common";
import { deleteClerkUser, invalidateUserCache } from "../auth";
import { getDb } from "../db/client";
import {
  accountDeletionRequests,
  aiGenerationJobs,
  aiRecommendations,
  episodeProgress,
  listItems,
  lists,
  rateLimitAttempts,
  recommendationFeedback,
  releaseSubscriptions,
  userNotifications,
  users,
  userTasteProfiles,
  watchItems,
  watchlistActivity,
  watchlistSnapshots,
  watchSessions,
} from "../db/schema";
import { getEnv } from "../env";
import { fail, ok } from "../schema/common";
import {
  cancelAccountDeletionArgsSchema,
  exportAccountDataArgsSchema,
  requestAccountDeletionArgsSchema,
} from "../schema/library";
import { authedFn, WRITE_RATE_LIMIT } from "./rpc";

function csvValue(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => csvValue(row[column])).join(","),
    ),
  ].join("\n");
}

export const exportAccountData = createServerFn({ method: "POST" })
  .validator(exportAccountDataArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({
        db,
        user,
      }): Promise<
        ApiResult<
          | { format: "json"; generatedAt: number; json: string }
          | { format: "csv"; generatedAt: number; csv: string }
        >
      > => {
        const [
          profile,
          watchlist,
          episodes,
          collections,
          collectionItems,
          snapshots,
          activity,
          recommendations,
          feedback,
          tasteProfile,
          subscriptions,
          notifications,
          sessions,
          jobs,
        ] = await Promise.all([
          db.select().from(users).where(eq(users.id, user.id)).limit(1),
          db.select().from(watchItems).where(eq(watchItems.userId, user.id)),
          db
            .select()
            .from(episodeProgress)
            .where(eq(episodeProgress.userId, user.id)),
          db.select().from(lists).where(eq(lists.userId, user.id)),
          db.select().from(listItems).where(eq(listItems.userId, user.id)),
          db
            .select()
            .from(watchlistSnapshots)
            .where(eq(watchlistSnapshots.userId, user.id)),
          db
            .select()
            .from(watchlistActivity)
            .where(eq(watchlistActivity.userId, user.id)),
          db
            .select()
            .from(aiRecommendations)
            .where(eq(aiRecommendations.userId, user.id)),
          db
            .select()
            .from(recommendationFeedback)
            .where(eq(recommendationFeedback.userId, user.id)),
          db
            .select()
            .from(userTasteProfiles)
            .where(eq(userTasteProfiles.userId, user.id)),
          db
            .select()
            .from(releaseSubscriptions)
            .where(eq(releaseSubscriptions.userId, user.id)),
          db
            .select()
            .from(userNotifications)
            .where(eq(userNotifications.userId, user.id)),
          db
            .select()
            .from(watchSessions)
            .where(eq(watchSessions.userId, user.id)),
          db
            .select()
            .from(aiGenerationJobs)
            .where(eq(aiGenerationJobs.userId, user.id)),
        ]);
        const payload = {
          profile: profile[0] ?? null,
          watchlist,
          episodes,
          collections,
          collectionItems,
          snapshots,
          activity,
          recommendations,
          feedback,
          tasteProfile: tasteProfile[0] ?? null,
          releaseSubscriptions: subscriptions,
          notifications,
          viewingSessions: sessions,
          generationJobs: jobs,
        };
        const generatedAt = Date.now();
        if (data.format === "csv") {
          return ok({
            format: "csv",
            generatedAt,
            csv: toCsv(watchlist as unknown as Record<string, unknown>[]),
          });
        }
        return ok({
          format: "json",
          generatedAt,
          json: JSON.stringify(payload, null, 2),
        });
      },
    ),
  );

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .validator(requestAccountDeletionArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({
        claims,
        db,
        user,
      }): Promise<ApiResult<{ scheduledFor: number }>> => {
        const now = Date.now();
        const scheduledFor = now + 30 * 24 * 60 * 60 * 1000;
        await db
          .insert(accountDeletionRequests)
          .values({
            userId: user.id,
            status: "pending",
            clerkUserId: claims.sub,
            requestedAt: now,
            scheduledFor,
          })
          .onConflictDoUpdate({
            target: accountDeletionRequests.userId,
            set: {
              status: "pending",
              clerkUserId: claims.sub,
              requestedAt: now,
              scheduledFor,
              canceledAt: null,
              completedAt: null,
            },
          });
        return ok({ scheduledFor });
      },
    ),
  );

export const cancelAccountDeletion = createServerFn({ method: "POST" })
  .validator(cancelAccountDeletionArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const rows = await db
          .select()
          .from(accountDeletionRequests)
          .where(
            and(
              eq(accountDeletionRequests.userId, user.id),
              eq(accountDeletionRequests.status, "pending"),
            ),
          )
          .limit(1);
        if (rows.length === 0)
          return fail("NOT_FOUND", "No pending deletion request");
        await db
          .update(accountDeletionRequests)
          .set({ status: "canceled", canceledAt: Date.now() })
          .where(eq(accountDeletionRequests.userId, user.id));
        return ok({ ok: true });
      },
    ),
  );

export async function processDueAccountDeletions(): Promise<number> {
  const db = getDb(getEnv());
  const now = Date.now();
  const due = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.status, "pending"),
        lte(accountDeletionRequests.scheduledFor, now),
      ),
    )
    .limit(100);
  let deleted = 0;
  for (const request of due) {
    const clerkDeleted = await deleteClerkUser(request.clerkUserId);
    if (!clerkDeleted) continue;
    await db.delete(users).where(eq(users.id, request.userId));
    await db
      .delete(rateLimitAttempts)
      .where(sql`${rateLimitAttempts.key} like ${`fnw:${request.userId}`}`);
    invalidateUserCache(request.userId);
    deleted++;
  }
  return deleted;
}
