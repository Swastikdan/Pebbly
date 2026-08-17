import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { requireUser } from "../auth";
import { getDb, runBatch } from "../db/client";
import { episodeProgress, watchItems } from "../db/schema";
import { getEnv } from "../env";
import { createWatchlistSnapshot } from "../helpers/snapshots";
import {
	buildMetadataPatch,
	bumpWatchlistRev,
	normalizeProgressStatus,
	normalizeReaction,
} from "../helpers/watch-item";
import { type ApiResult, ok } from "../schema/common";
import { importWatchlistArgsSchema } from "../schema/import";

export const importWatchlist = createServerFn({ method: "POST" })
	.validator(importWatchlistArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ imported: number }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const now = Date.now();
		const importedItems = new Map<string, (typeof data.items)[number]>();

		for (const item of data.items) {
			importedItems.set(`${item.mediaType}:${item.tmdbId}`, item);
		}

		const userWatchItems = await db
			.select()
			.from(watchItems)
			.where(eq(watchItems.userId, user.id))
			.limit(500);

		const existingMap = new Map<string, typeof watchItems.$inferSelect>();
		for (const item of userWatchItems) {
			existingMap.set(`${item.mediaType}:${item.tmdbId}`, item);
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

		// Execute the watch-item import in bounded batches. D1 batches run
		// atomically, but each call must finish within the platform's 30 s
		// budget, so a very large import is split into ≤100-statement batches.
		// Typical imports stay a single atomic round trip.
		await runBoundedBatches(db, watchStatements);

		// Episode writes accumulate here so they run as a second batch after the
		// watch-item batch.
		const episodeStatements: Parameters<typeof db.batch>[0][number][] = [];

		const importedTvIds = new Set(
			[...importedItems.values()]
				.filter((item) => item.mediaType === "tv")
				.map((item) => item.tmdbId),
		);

		const userEpisodes = await db
			.select()
			.from(episodeProgress)
			.where(eq(episodeProgress.userId, user.id))
			.limit(500);

		const existingEpisodeMap = new Map<
			string,
			typeof episodeProgress.$inferSelect
		>();
		for (const ep of userEpisodes) {
			existingEpisodeMap.set(`${ep.tmdbId}:${ep.season}:${ep.episode}`, ep);
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

		await runBoundedBatches(db, episodeStatements);

		await createWatchlistSnapshot(db, user.id);
		await bumpWatchlistRev(db, user.id);
		return ok({ imported: importedItems.size });
	});

/**
 * Run a statement list as one or more D1 `db.batch()` calls, capped at
 * `MAX_STATEMENTS_PER_BATCH` per call so a huge import stays within D1's
 * per-call execution budget (the platform requires the whole call to resolve
 * in 30 s). No-op for an empty list.
 */
async function runBoundedBatches(
	db: ReturnType<typeof getDb>,
	statements: Parameters<typeof db.batch>[0][number][],
) {
	if (statements.length === 0) return;
	const MAX_STATEMENTS_PER_BATCH = 100;
	for (let i = 0; i < statements.length; i += MAX_STATEMENTS_PER_BATCH) {
		await runBatch(db, statements.slice(i, i + MAX_STATEMENTS_PER_BATCH));
	}
}
