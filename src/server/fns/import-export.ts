import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { requireUser } from "../auth";
import { getDb } from "../db/client";
import { episodeProgress, watchItems } from "../db/schema";
import { getEnv } from "../env";
import { createWatchlistSnapshot } from "../helpers/snapshots";
import {
	buildMetadataPatch,
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
			.where(eq(watchItems.userId, user.id));

		const existingMap = new Map<string, typeof watchItems.$inferSelect>();
		for (const item of userWatchItems) {
			existingMap.set(`${item.mediaType}:${item.tmdbId}`, item);
		}

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

			if (existing) {
				await db
					.update(watchItems)
					.set({
						inWatchlist: true,
						progressStatus,
						progress,
						reaction,
						updatedAt: now,
						...metadata,
					})
					.where(eq(watchItems.id, existing.id));
			} else {
				await db
					.insert(watchItems)
					.values({
						id: crypto.randomUUID(),
						userId: user.id,
						tmdbId: item.tmdbId,
						mediaType: item.mediaType,
						inWatchlist: true,
						progressStatus,
						progress,
						reaction,
						updatedAt: now,
						...metadata,
					})
					.onConflictDoUpdate({
						target: [
							watchItems.userId,
							watchItems.tmdbId,
							watchItems.mediaType,
						],
						set: {
							inWatchlist: true,
							progressStatus,
							progress,
							reaction,
							updatedAt: now,
							...metadata,
						},
					});
			}
		}

		const importedTvIds = new Set(
			[...importedItems.values()]
				.filter((item) => item.mediaType === "tv")
				.map((item) => item.tmdbId),
		);

		const userEpisodes = await db
			.select()
			.from(episodeProgress)
			.where(eq(episodeProgress.userId, user.id));

		const existingEpisodeMap = new Map<
			string,
			typeof episodeProgress.$inferSelect
		>();
		for (const ep of userEpisodes) {
			existingEpisodeMap.set(`${ep.tmdbId}:${ep.season}:${ep.episode}`, ep);
		}

		const episodeKeys = new Set<string>();
		const episodesToUpsert: Array<{
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
					episodesToUpsert.push({
						id: existingEp.id,
						userId: user.id,
						tmdbId: episode.tmdbId,
						season: episode.season,
						episode: episode.episode,
						isWatched: true,
						updatedAt: now,
					});
				}
			} else {
				episodesToUpsert.push({
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

		// Insert/upsert episodes in chunks of 50 rows (each row has 7 params => 350 params, well within SQLite limits)
		const CHUNK_SIZE = 50;
		for (let i = 0; i < episodesToUpsert.length; i += CHUNK_SIZE) {
			const chunk = episodesToUpsert.slice(i, i + CHUNK_SIZE);
			if (chunk.length > 0) {
				await db
					.insert(episodeProgress)
					.values(chunk)
					.onConflictDoUpdate({
						target: [
							episodeProgress.userId,
							episodeProgress.tmdbId,
							episodeProgress.season,
							episodeProgress.episode,
						],
						set: {
							isWatched: true,
							updatedAt: now,
						},
					});
			}
		}

		await createWatchlistSnapshot(db, user.id);
		return ok({ imported: importedItems.size });
	});
