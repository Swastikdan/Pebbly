import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { getDb } from "../db/client";
import { users, watchItems, watchlistSnapshots } from "../db/schema";
import { getEnv } from "../env";

/**
 * Port of `createWatchlistSnapshot` — records the current watchlist media state
 * (TMDB IDs & media types) unless it is identical to the latest snapshot.
 */
export async function createWatchlistSnapshot(
	db: Db,
	userId: string,
): Promise<void> {
	const items = await db
		.select({
			tmdbId: watchItems.tmdbId,
			mediaType: watchItems.mediaType,
			inWatchlist: watchItems.inWatchlist,
		})
		.from(watchItems)
		.where(eq(watchItems.userId, userId))
		.limit(500);

	const watchlistItems = items
		.filter((item) => item.inWatchlist !== false)
		.map((item) => ({ tmdbId: item.tmdbId, mediaType: item.mediaType }))
		.sort(
			(a, b) => a.tmdbId - b.tmdbId || a.mediaType.localeCompare(b.mediaType),
		);

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
				item.tmdbId === watchlistItems[index]?.tmdbId &&
				item.mediaType === watchlistItems[index]?.mediaType,
		)
	) {
		return;
	}

	await db.insert(watchlistSnapshots).values({
		id: crypto.randomUUID(),
		userId,
		items: watchlistItems.slice(0, 8000),
		createdAt: Date.now(),
	});
}

/**
 * Port of `createDailySnapshots` — iterates users in batches of 50, creating a
 * snapshot for each. Runs from the Cloudflare cron (server/tasks/snapshots.ts).
 */
export async function createDailySnapshots(): Promise<void> {
	const db = getDb(getEnv());

	// D1 query limits: keep batches bounded (50 like Convex pagination).
	let cursor = 0;
	for (;;) {
		const batch = await db
			.select({ id: users.id })
			.from(users)
			.orderBy(users.id)
			.limit(50)
			.offset(cursor);

		if (batch.length === 0) break;

		for (const user of batch) {
			try {
				await createWatchlistSnapshot(db, user.id);
			} catch (error) {
				console.error(`Failed to create snapshot for user ${user.id}:`, error);
			}
		}

		cursor += batch.length;
	}
}
