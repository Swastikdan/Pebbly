import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "drizzle-orm";

import { MAX_IDS_PER_IN_CLAUSE, runBatch } from "../db/client";
import { episodeProgress, watchItems } from "../db/schema";
import { createWatchlistSnapshot } from "../helpers/snapshots";
import {
  buildMetadataPatch,
  bumpWatchlistRev,
  normalizeProgressStatus,
  normalizeReaction,
} from "../helpers/watch-item";
import { ok } from "../schema/common";
import { importWatchlistArgsSchema } from "../schema/import";
import { authedFn, WRITE_RATE_LIMIT } from "./rpc";

export const importWatchlist = createServerFn({ method: "POST" })
  .validator(importWatchlistArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }) => {
        const now = Date.now();
        const importedItems = new Map<string, (typeof data.items)[number]>();

        for (const item of data.items) {
          importedItems.set(`${item.mediaType}:${item.tmdbId}`, item);
        }

        const tmdbIds = [...new Set(data.items.map((item) => item.tmdbId))];
        const existingMap = new Map<string, typeof watchItems.$inferSelect>();
        for (let i = 0; i < tmdbIds.length; i += MAX_IDS_PER_IN_CLAUSE) {
          const rows = await db
            .select()
            .from(watchItems)
            .where(
              and(
                eq(watchItems.userId, user.id),
                inArray(
                  watchItems.tmdbId,
                  tmdbIds.slice(i, i + MAX_IDS_PER_IN_CLAUSE),
                ),
              ),
            );
          for (const row of rows) {
            existingMap.set(`${row.mediaType}:${row.tmdbId}`, row);
          }
        }

        const watchStatements: Parameters<typeof db.batch>[0][number][] = [];
        for (const item of importedItems.values()) {
          const existing = existingMap.get(`${item.mediaType}:${item.tmdbId}`);
          const progressStatus =
            normalizeProgressStatus(item.progressStatus) ?? "watch-later";
          const rawProgress =
            item.progress ??
            (progressStatus === "done"
              ? 100
              : progressStatus === "watch-later"
                ? 0
                : (existing?.progress ?? 0));
          const progress = Math.min(Math.max(rawProgress, 0), 100);
          const reaction =
            normalizeReaction(item.reaction) ??
            normalizeReaction(existing?.reaction) ??
            null;
          const metadata = buildMetadataPatch(item, existing ?? undefined);

          const inWatchlist =
            item.inWatchlist !== undefined && item.inWatchlist !== null
              ? item.inWatchlist
              : (existing?.inWatchlist ?? true);

          if (existing) {
            watchStatements.push(
              db
                .update(watchItems)
                .set({
                  inWatchlist,
                  progressStatus,
                  progress,
                  reaction,
                  updatedAt: now,
                  ...metadata,
                })
                .where(eq(watchItems.id, existing.id)),
            );
          } else {
            watchStatements.push(
              db
                .insert(watchItems)
                .values({
                  id: crypto.randomUUID(),
                  userId: user.id,
                  tmdbId: item.tmdbId,
                  mediaType: item.mediaType,
                  inWatchlist,
                  progressStatus,
                  progress,
                  reaction,
                  updatedAt: now,
                  ...metadata,
                })
                .onConflictDoNothing(),
            );
          }
        }

        await runBatch(db, watchStatements);

        const episodeStatements: Parameters<typeof db.batch>[0][number][] = [];

        const importedTvIds = new Set(
          [...importedItems.values()]
            .filter((item) => item.mediaType === "tv")
            .map((item) => item.tmdbId),
        );

        const existingEpisodeMap = new Map<
          string,
          typeof episodeProgress.$inferSelect
        >();
        const tvIds = [...importedTvIds];
        for (let i = 0; i < tvIds.length; i += MAX_IDS_PER_IN_CLAUSE) {
          const rows = await db
            .select()
            .from(episodeProgress)
            .where(
              and(
                eq(episodeProgress.userId, user.id),
                inArray(
                  episodeProgress.tmdbId,
                  tvIds.slice(i, i + MAX_IDS_PER_IN_CLAUSE),
                ),
              ),
            );
          for (const ep of rows) {
            existingEpisodeMap.set(
              `${ep.tmdbId}:${ep.season}:${ep.episode}`,
              ep,
            );
          }
        }

        const episodeKeys = new Set<string>();
        const episodesToInsert: Array<{
          id: string;
          userId: string;
          tmdbId: number;
          season: number;
          episode: number;
          isWatched: boolean;
          updatedAt: number;
        }> = [];

        for (const episode of data.watchedEpisodes) {
          if (!importedTvIds.has(episode.tmdbId)) continue;
          const key = `${episode.tmdbId}:${episode.season}:${episode.episode}`;
          if (episodeKeys.has(key)) continue;
          episodeKeys.add(key);

          const existingEp = existingEpisodeMap.get(key);
          if (existingEp) {
            if (!existingEp.isWatched) {
              episodeStatements.push(
                db
                  .update(episodeProgress)
                  .set({ isWatched: true, updatedAt: now })
                  .where(eq(episodeProgress.id, existingEp.id)),
              );
            }
          } else {
            episodesToInsert.push({
              id: crypto.randomUUID(),
              userId: user.id,
              tmdbId: episode.tmdbId,
              season: episode.season,
              episode: episode.episode,
              isWatched: true,
              updatedAt: now,
            });
          }
        }

        // Insert new episodes in chunks of 14 rows: each row binds 7 parameters
        // (id, userId, tmdbId, season, episode, isWatched, updatedAt) and D1 caps
        // bound parameters at 100 per query. A larger chunk would make the
        // multi-row INSERT exceed that limit and fail the whole import.
        const EPISODE_CHUNK_ROWS = 14;
        for (let i = 0; i < episodesToInsert.length; i += EPISODE_CHUNK_ROWS) {
          const chunk = episodesToInsert.slice(i, i + EPISODE_CHUNK_ROWS);
          if (chunk.length > 0) {
            episodeStatements.push(
              db.insert(episodeProgress).values(chunk).onConflictDoNothing(),
            );
          }
        }

        await runBatch(db, episodeStatements);

        if (data.final !== false) {
          await createWatchlistSnapshot(db, user.id);
          await bumpWatchlistRev(db, user.id);
        }
        return ok({ imported: importedItems.size });
      },
    ),
  );
