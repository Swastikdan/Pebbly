import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { requireUser } from "../auth";
import { getDb } from "../db/client";
import { watchItems } from "../db/schema";
import { getEnv } from "../env";
import { createWatchlistSnapshot } from "../helpers/snapshots";
import {
	buildMetadataPatch,
	normalizeProgressStatus,
	normalizeReaction,
} from "../helpers/watch-item";
import { type ApiResult, ok } from "../schema/common";
import { importWatchlistArgsSchema } from "../schema/import";
import { syncEpisodeProgressRecord } from "./watchlist";

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
				await db.insert(watchItems).values({
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
				});
			}
		}

		const importedTvIds = new Set(
			[...importedItems.values()]
				.filter((item) => item.mediaType === "tv")
				.map((item) => item.tmdbId),
		);
		const episodeKeys = new Set<string>();
		for (const episode of data.watchedEpisodes) {
			if (!importedTvIds.has(episode.tmdbId)) continue;
			const key = `${episode.tmdbId}:${episode.season}:${episode.episode}`;
			if (episodeKeys.has(key)) continue;
			episodeKeys.add(key);
			await syncEpisodeProgressRecord(
				user.id,
				{ ...episode, isWatched: true },
				now,
			);
		}

		await createWatchlistSnapshot(db, user.id);
		return ok({ imported: importedItems.size });
	});
