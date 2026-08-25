import { and, eq, gt } from "drizzle-orm";

import type { Db } from "../db/client";
import { runBatch } from "../db/client";
import { episodeProgress } from "../db/schema";
import { collectAllByKeyset } from "./paginate";
import { bumpWatchlistRev } from "./watch-item";

export type EpisodeSyncArgs = {
  tmdbId: number;
  season: number;
  episode: number;
  isWatched: boolean;
};

/**
 * Build the write statements needed to sync one episode's watched state.
 * `existingByKey` maps `season:episode` -> row and is preloaded once by the
 * caller, so the whole season/show sync becomes one read + one db.batch.
 */
export function buildEpisodeSyncStatements(
  db: Db,
  userId: string,
  args: EpisodeSyncArgs,
  now: number,
  existingByKey: Map<string, typeof episodeProgress.$inferSelect>,
) {
  const statements: Parameters<typeof db.batch>[0][number][] = [];
  const existing = existingByKey.get(`${args.season}:${args.episode}`);

  if (existing) {
    if (existing.isWatched !== args.isWatched) {
      statements.push(
        db
          .update(episodeProgress)
          .set({ isWatched: args.isWatched, updatedAt: now })
          .where(eq(episodeProgress.id, existing.id)),
      );
    }
    return statements;
  }

  if (!args.isWatched) {
    return statements;
  }

  statements.push(
    db
      .insert(episodeProgress)
      .values({
        id: crypto.randomUUID(),
        userId,
        tmdbId: args.tmdbId,
        season: args.season,
        episode: args.episode,
        isWatched: args.isWatched,
        updatedAt: now,
      })
      .onConflictDoNothing(),
  );
  return statements;
}

/**
 * Loads all episode progress rows for a user and TMDB title.
 *
 * @param userId - The user whose progress rows to load
 * @param tmdbId - The TMDB title identifier
 * @returns A map of progress rows keyed by season and episode
 */
export async function loadEpisodeRowsByKey(
  db: Db,
  userId: string,
  tmdbId: number,
): Promise<Map<string, typeof episodeProgress.$inferSelect>> {
  const rowsByKey = new Map<string, typeof episodeProgress.$inferSelect>();
  // Keyset pagination instead of a hard cap: long-running shows can have
  // >1000 watched rows, and missing any would corrupt the sync (rows past
  // the cap would be re-inserted or never cleared).
  const rows = await collectAllByKeyset(500, (cursor) =>
    db
      .select()
      .from(episodeProgress)
      .where(
        and(
          eq(episodeProgress.userId, userId),
          eq(episodeProgress.tmdbId, tmdbId),
          cursor ? gt(episodeProgress.id, cursor) : undefined,
        ),
      )
      .orderBy(episodeProgress.id)
      .limit(500),
  );
  for (const row of rows) {
    rowsByKey.set(`${row.season}:${row.episode}`, row);
  }
  return rowsByKey;
}

export async function syncEpisodeProgressRecord(
  db: Db,
  userId: string,
  args: EpisodeSyncArgs,
  now: number,
) {
  const existingByKey = await loadEpisodeRowsByKey(db, userId, args.tmdbId);
  const statements = buildEpisodeSyncStatements(
    db,
    userId,
    args,
    now,
    existingByKey,
  );
  await runBatch(db, statements);
  await bumpWatchlistRev(db, userId);
}
