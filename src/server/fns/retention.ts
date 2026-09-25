import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { ApiResult } from "../schema/common";
import { getWatchProviders } from "@/lib/queries";
import {
  episodeProgress,
  releaseSubscriptions,
  userNotifications,
  watchItems,
  watchSessions,
} from "../db/schema";
import { ok } from "../schema/common";
import {
  getInsightsArgsSchema,
  listNotificationsArgsSchema,
  markNotificationReadArgsSchema,
  recordWatchSessionArgsSchema,
  releaseSubscriptionArgsSchema,
} from "../schema/library";
import { authedFn, WRITE_RATE_LIMIT } from "./rpc";

type ReleaseCalendarItem = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string | null;
  image: string | null;
  releaseDate: string | null;
  overview: string | null;
  progressStatus: "watch-later" | "watching" | "done" | "dropped" | null;
  subscribed: boolean;
  notifyRelease: boolean;
  notifyAvailability: boolean;
};

export const getReleaseCalendar = createServerFn({ method: "POST" }).handler(
  () =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      undefined,
      async ({ db, user }): Promise<ApiResult<ReleaseCalendarItem[]>> => {
        const today = new Date().toISOString().slice(0, 10);
        const [rows, subscriptions] = await Promise.all([
          db
            .select({
              tmdbId: watchItems.tmdbId,
              mediaType: watchItems.mediaType,
              title: watchItems.title,
              image: watchItems.image,
              releaseDate: watchItems.releaseDate,
              overview: watchItems.overview,
              progressStatus: watchItems.progressStatus,
            })
            .from(watchItems)
            .where(
              and(
                eq(watchItems.userId, user.id),
                eq(watchItems.inWatchlist, true),
                gte(watchItems.releaseDate, today),
              ),
            )
            .orderBy(watchItems.releaseDate),
          db
            .select()
            .from(releaseSubscriptions)
            .where(eq(releaseSubscriptions.userId, user.id)),
        ]);
        const byKey = new Map(
          subscriptions.map((item) => [
            `${item.mediaType}:${item.tmdbId}`,
            item,
          ]),
        );
        return ok(
          rows.map((row) => {
            const subscription = byKey.get(`${row.mediaType}:${row.tmdbId}`);
            return {
              ...row,
              subscribed: Boolean(subscription),
              notifyRelease: subscription?.notifyRelease ?? false,
              notifyAvailability: subscription?.notifyAvailability ?? false,
            };
          }),
        );
      },
    ),
);

export const subscribeToRelease = createServerFn({ method: "POST" })
  .validator(releaseSubscriptionArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        await db
          .insert(releaseSubscriptions)
          .values({
            id: crypto.randomUUID(),
            userId: user.id,
            tmdbId: data.tmdbId,
            mediaType: data.mediaType,
            title: data.title,
            releaseDate: data.releaseDate,
            region: data.region ?? "US",
            notifyRelease: data.notifyRelease ?? true,
            notifyAvailability: data.notifyAvailability ?? true,
            createdAt: Date.now(),
          })
          .onConflictDoUpdate({
            target: [
              releaseSubscriptions.userId,
              releaseSubscriptions.tmdbId,
              releaseSubscriptions.mediaType,
            ],
            set: {
              title: data.title,
              releaseDate: data.releaseDate,
              region: data.region ?? "US",
              notifyRelease: data.notifyRelease ?? true,
              notifyAvailability: data.notifyAvailability ?? true,
            },
          });
        return ok({ ok: true });
      },
    ),
  );

export const unsubscribeFromRelease = createServerFn({ method: "POST" })
  .validator(releaseSubscriptionArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        await db
          .delete(releaseSubscriptions)
          .where(
            and(
              eq(releaseSubscriptions.userId, user.id),
              eq(releaseSubscriptions.tmdbId, data.tmdbId),
              eq(releaseSubscriptions.mediaType, data.mediaType),
            ),
          );
        return ok({ ok: true });
      },
    ),
  );

export const listNotifications = createServerFn({ method: "POST" })
  .validator(listNotificationsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      data,
      async ({
        db,
        user,
      }): Promise<ApiResult<(typeof userNotifications.$inferSelect)[]>> => {
        const rows = await db
          .select()
          .from(userNotifications)
          .where(eq(userNotifications.userId, user.id))
          .orderBy(desc(userNotifications.createdAt))
          .limit(data.limit ?? 50);
        return ok(rows);
      },
    ),
  );

export const markNotificationRead = createServerFn({ method: "POST" })
  .validator(markNotificationReadArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        await db
          .update(userNotifications)
          .set({ readAt: Date.now() })
          .where(
            and(
              eq(userNotifications.id, data.notificationId),
              eq(userNotifications.userId, user.id),
            ),
          );
        return ok({ ok: true });
      },
    ),
  );

export const recordWatchSession = createServerFn({ method: "POST" })
  .validator(recordWatchSessionArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        await db
          .insert(watchSessions)
          .values({
            id: data.clientEventId,
            userId: user.id,
            tmdbId: data.tmdbId,
            mediaType: data.mediaType,
            season: data.season,
            episode: data.episode,
            startedAt: Math.min(data.startedAt, data.endedAt),
            endedAt: Math.max(data.startedAt, data.endedAt),
            watchedSeconds: Math.round(data.watchedSeconds),
            progressPercent: Math.round(data.progressPercent),
            createdAt: Date.now(),
          })
          .onConflictDoNothing();
        return ok({ ok: true });
      },
    ),
  );

export const getViewingInsights = createServerFn({ method: "POST" })
  .validator(getInsightsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "current", guest: () => ok(null) },
      data,
      async ({
        db,
        user,
      }): Promise<
        ApiResult<{
          year: number;
          watchTimeMinutes: number;
          completedTitles: number;
          startedTitles: number;
          watchedEpisodes: number;
          averageRating: number | null;
          topTitles: Array<{
            tmdbId: number;
            mediaType: string;
            title: string | null;
            sessions: number;
            minutes: number;
          }>;
        } | null>
      > => {
        const year = data.year ?? new Date().getUTCFullYear();
        const start = Date.UTC(year, 0, 1);
        const end = Date.UTC(year + 1, 0, 1);
        const [
          sessionRows,
          completedRows,
          startedRows,
          episodeRows,
          ratingRows,
        ] = await Promise.all([
          db
            .select({
              tmdbId: watchSessions.tmdbId,
              mediaType: watchSessions.mediaType,
              title: watchItems.title,
              sessions: sql<number>`count(*)`,
              minutes: sql<number>`coalesce(sum(${watchSessions.watchedSeconds}), 0) / 60`,
            })
            .from(watchSessions)
            .leftJoin(
              watchItems,
              and(
                eq(watchItems.userId, watchSessions.userId),
                eq(watchItems.tmdbId, watchSessions.tmdbId),
                eq(watchItems.mediaType, watchSessions.mediaType),
              ),
            )
            .where(
              and(
                eq(watchSessions.userId, user.id),
                gte(watchSessions.startedAt, start),
                sql`${watchSessions.startedAt} < ${end}`,
              ),
            )
            .groupBy(
              watchSessions.tmdbId,
              watchSessions.mediaType,
              watchItems.title,
            )
            .orderBy(
              desc(sql`coalesce(sum(${watchSessions.watchedSeconds}), 0)`),
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(watchItems)
            .where(
              and(
                eq(watchItems.userId, user.id),
                eq(watchItems.inWatchlist, true),
                eq(watchItems.progressStatus, "done"),
                gte(watchItems.updatedAt, start),
                sql`${watchItems.updatedAt} < ${end}`,
              ),
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(watchItems)
            .where(
              and(
                eq(watchItems.userId, user.id),
                eq(watchItems.inWatchlist, true),
                eq(watchItems.progressStatus, "watching"),
                gte(watchItems.updatedAt, start),
                sql`${watchItems.updatedAt} < ${end}`,
              ),
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(episodeProgress)
            .where(
              and(
                eq(episodeProgress.userId, user.id),
                eq(episodeProgress.isWatched, true),
                gte(episodeProgress.updatedAt, start),
                sql`${episodeProgress.updatedAt} < ${end}`,
              ),
            ),
          db
            .select({ average: sql<number>`avg(${watchItems.rating})` })
            .from(watchItems)
            .where(eq(watchItems.userId, user.id)),
        ]);
        return ok({
          year,
          watchTimeMinutes: Math.round(
            sessionRows.reduce((sum, row) => sum + Number(row.minutes), 0),
          ),
          completedTitles: Number(completedRows[0]?.count ?? 0),
          startedTitles: Number(startedRows[0]?.count ?? 0),
          watchedEpisodes: Number(episodeRows[0]?.count ?? 0),
          averageRating:
            ratingRows[0]?.average == null
              ? null
              : Number(ratingRows[0].average),
          topTitles: sessionRows.slice(0, 10).map((row) => ({
            tmdbId: row.tmdbId,
            mediaType: row.mediaType,
            title: row.title,
            sessions: Number(row.sessions),
            minutes: Math.round(Number(row.minutes)),
          })),
        });
      },
    ),
  );

export async function refreshReleaseAvailability(): Promise<number> {
  const { getDb } = await import("../db/client");
  const { getEnv } = await import("../env");
  const db = getDb(getEnv());
  const subscriptions = await db.select().from(releaseSubscriptions);
  let notifications = 0;
  for (const subscription of subscriptions) {
    try {
      const providers = await getWatchProviders({
        id: subscription.tmdbId,
        type: subscription.mediaType,
      });
      const country = providers.results[subscription.region] ?? {};
      const names = [
        ...(country.flatrate ?? []),
        ...(country.free ?? []),
        ...(country.ads ?? []),
        ...(country.rent ?? []),
        ...(country.buy ?? []),
      ]
        .map((provider) => provider.provider_name)
        .sort();
      const hash = JSON.stringify(names);
      if (
        subscription.availabilityHash &&
        subscription.availabilityHash !== hash &&
        subscription.notifyAvailability
      ) {
        await db
          .insert(userNotifications)
          .values({
            id: crypto.randomUUID(),
            userId: subscription.userId,
            kind: "availability",
            title: `${subscription.title ?? "A saved title"} is now available`,
            body:
              names.length > 0
                ? `Available on ${names.join(", ")}`
                : "Availability changed in your region.",
            dedupeKey: `availability:${subscription.id}:${hash}`,
            createdAt: Date.now(),
          })
          .onConflictDoNothing();
        notifications++;
      }
      await db
        .update(releaseSubscriptions)
        .set({ availabilityHash: hash, lastCheckedAt: Date.now() })
        .where(eq(releaseSubscriptions.id, subscription.id));
    } catch (error) {
      console.error("Failed to refresh release availability", error);
    }
  }
  return notifications;
}

export async function processDueReleaseNotifications(): Promise<number> {
  const { getDb } = await import("../db/client");
  const { getEnv } = await import("../env");
  const db = getDb(getEnv());
  const now = Date.now();
  const due = await db
    .select()
    .from(releaseSubscriptions)
    .where(
      and(
        eq(releaseSubscriptions.notifyRelease, true),
        sql`${releaseSubscriptions.releaseDate} <= ${new Date(now).toISOString().slice(0, 10)}`,
      ),
    );
  let notifications = 0;
  for (const subscription of due) {
    const result = await db
      .insert(userNotifications)
      .values({
        id: crypto.randomUUID(),
        userId: subscription.userId,
        kind: "release",
        title: `${subscription.title ?? "A saved title"} has a release date`,
        body: `It is now available to watch in ${subscription.region}.`,
        dedupeKey: `release:${subscription.id}`,
        createdAt: now,
      })
      .onConflictDoNothing();
    if (result.changes > 0) notifications++;
  }
  return notifications;
}
