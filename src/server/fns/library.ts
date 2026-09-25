import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import type {
  ApiResult,
  MediaType,
  ProgressStatus,
  Reaction,
} from "../schema/common";
import { runBatch } from "../db/client";
import {
  watchItems,
  watchlistActivity,
  watchlistSnapshots,
} from "../db/schema";
import { createWatchlistSnapshot } from "../helpers/snapshots";
import {
  bumpWatchlistRev,
  getWatchItem,
  planMembershipRemoval,
  upsertWatchItem,
} from "../helpers/watch-item";
import { fail, ok } from "../schema/common";
import {
  getWatchlistActivityArgsSchema,
  getWatchlistSnapshotsArgsSchema,
  restoreWatchlistSnapshotArgsSchema,
  undoWatchlistActivityArgsSchema,
} from "../schema/library";
import { authedFn, WRITE_RATE_LIMIT } from "./rpc";

type ActivityCursor = { createdAt: number; id: string };

function encodeActivityCursor(cursor: ActivityCursor) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(cursor))));
}

function decodeActivityCursor(value?: string): ActivityCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(value)))) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "number" || typeof parsed.id !== "string") {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export const getWatchlistActivity = createServerFn({ method: "POST" })
  .validator(getWatchlistActivityArgsSchema)
  .handler(({ data }) =>
    authedFn(
      {
        mode: "current",
        guest: () => ok({ items: [], nextCursor: null, hasNextPage: false }),
      },
      data,
      async ({
        db,
        user,
      }): Promise<
        ApiResult<{
          items: (typeof watchlistActivity.$inferSelect)[];
          nextCursor: string | null;
          hasNextPage: boolean;
        }>
      > => {
        const cursor = decodeActivityCursor(data.cursor);
        const limit = data.limit ?? 30;
        const rows = await db
          .select()
          .from(watchlistActivity)
          .where(
            and(
              eq(watchlistActivity.userId, user.id),
              cursor
                ? or(
                    lt(watchlistActivity.createdAt, cursor.createdAt),
                    and(
                      eq(watchlistActivity.createdAt, cursor.createdAt),
                      lt(watchlistActivity.id, cursor.id),
                    ),
                  )
                : undefined,
            ),
          )
          .orderBy(
            desc(watchlistActivity.createdAt),
            desc(watchlistActivity.id),
          )
          .limit(limit + 1);
        const hasNextPage = rows.length > limit;
        const items = hasNextPage ? rows.slice(0, limit) : rows;
        const last = items[items.length - 1];
        return ok({
          items,
          hasNextPage,
          nextCursor:
            hasNextPage && last
              ? encodeActivityCursor({ createdAt: last.createdAt, id: last.id })
              : null,
        });
      },
    ),
  );

export const undoWatchlistActivity = createServerFn({ method: "POST" })
  .validator(undoWatchlistActivityArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const rows = await db
          .select()
          .from(watchlistActivity)
          .where(
            and(
              eq(watchlistActivity.id, data.activityId),
              eq(watchlistActivity.userId, user.id),
            ),
          )
          .limit(1);
        const activity = rows[0];
        if (!activity) return fail("NOT_FOUND", "Activity not found");
        if (activity.revertedAt) return ok({ ok: true });

        const current = await getWatchItem(db, user.id, {
          tmdbId: activity.tmdbId,
          mediaType: activity.mediaType,
        });

        if (current && current.updatedAt > activity.createdAt) {
          return fail("CONFLICT", "This item changed after that activity");
        }

        if (activity.action === "added") {
          if (current) {
            const plan = planMembershipRemoval(current, Date.now());
            if (plan.delete) {
              await db.delete(watchItems).where(eq(watchItems.id, current.id));
            } else {
              await db
                .update(watchItems)
                .set({
                  inWatchlist: plan.nextRow.inWatchlist,
                  progressStatus: plan.nextRow.progressStatus,
                  progress: plan.nextRow.progress,
                  reaction: plan.nextRow.reaction,
                  updatedAt: plan.nextRow.updatedAt,
                })
                .where(eq(watchItems.id, current.id));
            }
          }
        } else {
          await upsertWatchItem(
            db,
            user.id,
            activity.tmdbId,
            activity.mediaType,
            {
              inWatchlist:
                activity.action === "removed"
                  ? true
                  : (current?.inWatchlist ?? true),
              progressStatus: activity.previousStatus as ProgressStatus | null,
              reaction: activity.previousReaction as Reaction | null,
              progress: activity.previousProgress ?? 0,
              title: activity.title,
              image: activity.image,
              rating: activity.rating,
              release_date: activity.releaseDate,
              overview: activity.overview,
            },
          );
        }

        await db
          .update(watchlistActivity)
          .set({ revertedAt: Date.now() })
          .where(eq(watchlistActivity.id, activity.id));
        await bumpWatchlistRev(db, user.id);
        await createWatchlistSnapshot(db, user.id);
        return ok({ ok: true });
      },
    ),
  );

export const getWatchlistSnapshots = createServerFn({ method: "POST" })
  .validator(getWatchlistSnapshotsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      data,
      async ({
        db,
        user,
      }): Promise<
        ApiResult<Array<{ id: string; createdAt: number; itemCount: number }>>
      > => {
        const rows = await db
          .select({
            id: watchlistSnapshots.id,
            createdAt: watchlistSnapshots.createdAt,
            itemCount: sql<number>`coalesce(json_array_length(${watchlistSnapshots.items}), 0)`,
          })
          .from(watchlistSnapshots)
          .where(eq(watchlistSnapshots.userId, user.id))
          .orderBy(
            desc(watchlistSnapshots.createdAt),
            desc(watchlistSnapshots.id),
          )
          .limit(data.limit ?? 30);
        return ok(
          rows.map((row) => ({ ...row, itemCount: Number(row.itemCount) })),
        );
      },
    ),
  );

export const restoreWatchlistSnapshot = createServerFn({ method: "POST" })
  .validator(restoreWatchlistSnapshotArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const rows = await db
          .select()
          .from(watchlistSnapshots)
          .where(
            and(
              eq(watchlistSnapshots.id, data.snapshotId),
              eq(watchlistSnapshots.userId, user.id),
            ),
          )
          .limit(1);
        const snapshot = rows[0];
        if (!snapshot?.items) return fail("NOT_FOUND", "Snapshot not found");

        const statements: unknown[] = [
          db
            .delete(watchItems)
            .where(
              and(
                eq(watchItems.userId, user.id),
                eq(watchItems.inWatchlist, true),
              ),
            ),
        ];
        for (const item of snapshot.items) {
          statements.push(
            db
              .insert(watchItems)
              .values({
                id: crypto.randomUUID(),
                userId: user.id,
                tmdbId: item.tmdbId,
                mediaType: item.mediaType as MediaType,
                inWatchlist: true,
                progressStatus: item.progressStatus as ProgressStatus | null,
                reaction: item.reaction as Reaction | null,
                progress: item.progress,
                title: item.title,
                image: item.image,
                rating: item.rating,
                releaseDate: item.releaseDate,
                overview: item.overview,
                updatedAt: Date.now(),
              })
              .onConflictDoUpdate({
                target: [
                  watchItems.userId,
                  watchItems.tmdbId,
                  watchItems.mediaType,
                ],
                set: {
                  inWatchlist: true,
                  progressStatus: item.progressStatus as ProgressStatus | null,
                  reaction: item.reaction as Reaction | null,
                  progress: item.progress,
                  title: item.title,
                  image: item.image,
                  rating: item.rating,
                  releaseDate: item.releaseDate,
                  overview: item.overview,
                  updatedAt: Date.now(),
                },
              }),
          );
        }
        await runBatch(db, statements);
        await bumpWatchlistRev(db, user.id);
        await createWatchlistSnapshot(db, user.id);
        return ok({ ok: true });
      },
    ),
  );
