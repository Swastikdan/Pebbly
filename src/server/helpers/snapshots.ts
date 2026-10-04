import { and, desc, eq, gt, or } from "drizzle-orm";

import type { Db } from "../db/client";
import type { MediaType } from "../schema/common";
import { getDb } from "../db/client";
import { users, watchItems, watchlistSnapshots } from "../db/schema";
import { getEnv } from "../env";

type SnapshotItem = {
  tmdbId: number;
  mediaType: MediaType;
  progressStatus: string | null;
  reaction: string | null;
  progress: number | null;
  title: string | null;
  image: string | null;
  rating: number | null;
  releaseDate: string | null;
  overview: string | null;
};

export async function createWatchlistSnapshot(
  db: Db,
  userId: string,
): Promise<void> {
  const items = [];
  let cursor: { tmdbId: number; mediaType: MediaType } | null = null;
  for (;;) {
    const page: SnapshotItem[] = await db
      .select({
        tmdbId: watchItems.tmdbId,
        mediaType: watchItems.mediaType,
        progressStatus: watchItems.progressStatus,
        reaction: watchItems.reaction,
        progress: watchItems.progress,
        title: watchItems.title,
        image: watchItems.image,
        rating: watchItems.rating,
        releaseDate: watchItems.releaseDate,
        overview: watchItems.overview,
      })
      .from(watchItems)
      .where(
        and(
          eq(watchItems.userId, userId),
          eq(watchItems.inWatchlist, true),
          cursor
            ? or(
                gt(watchItems.tmdbId, cursor.tmdbId),
                and(
                  eq(watchItems.tmdbId, cursor.tmdbId),
                  gt(watchItems.mediaType, cursor.mediaType),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(watchItems.tmdbId, watchItems.mediaType)
      .limit(500);
    items.push(...page);
    if (page.length < 500) break;
    const last = page[page.length - 1];
    cursor = { tmdbId: last.tmdbId, mediaType: last.mediaType };
  }

  const watchlistItems = items.map((item) => ({
    ...item,
    progressStatus: item.progressStatus ?? null,
    reaction: item.reaction ?? null,
    progress: item.progress ?? null,
  }));

  const latest = await db
    .select()
    .from(watchlistSnapshots)
    .where(eq(watchlistSnapshots.userId, userId))
    .orderBy(desc(watchlistSnapshots.createdAt))
    .limit(1);

  if (
    latest.length > 0 &&
    latest[0].items &&
    latest[0].items.length === watchlistItems.length &&
    latest[0].items.every(
      (item, index) =>
        JSON.stringify(item) === JSON.stringify(watchlistItems[index]),
    )
  ) {
    return;
  }

  await db.insert(watchlistSnapshots).values({
    id: crypto.randomUUID(),
    userId,
    items: watchlistItems,
    createdAt: Date.now(),
  });
}

/**
 * Iterates users with keyset pagination,
 * creating a snapshot for each. Runs from the Cloudflare cron
 * (server/tasks/snapshots.ts).
 *
 * Each invocation is bounded by `maxUsers` (keyset over users.id > lastId),
 * so a slow invocation cannot exceed the Worker's execution budget. Users are
 * processed in id order; when the page ends we resume from the last processed
 * id on the next cron run (the caller passes the persisted cursor).
 */
export async function createDailySnapshots(
  lastProcessedId = "",
  maxUsers = 200,
): Promise<{ lastProcessedId: string; processed: number }> {
  const db = getDb(getEnv());

  let cursor = lastProcessedId;
  let processed = 0;
  for (;;) {
    const batch = await db
      .select({ id: users.id })
      .from(users)
      .where(cursor ? gt(users.id, cursor) : undefined)
      .orderBy(users.id)
      .limit(50);

    if (batch.length === 0) {
      cursor = "";
      break;
    }

    for (const user of batch) {
      if (processed >= maxUsers) return { lastProcessedId: cursor, processed };
      try {
        await createWatchlistSnapshot(db, user.id);
      } catch (error) {
        console.error(`Failed to create snapshot for user ${user.id}:`, error);
      }
      processed++;
      cursor = user.id;
    }
  }

  return { lastProcessedId: cursor, processed };
}
