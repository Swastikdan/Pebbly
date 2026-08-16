import { desc, eq, gt } from "drizzle-orm";
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
		// Deterministic order before limit so the same watchlist always yields
		// the same snapshot content.
		.orderBy(watchItems.tmdbId, watchItems.mediaType)
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

	// The query already caps rows at 500, so no extra slice is needed.
	await db.insert(watchlistSnapshots).values({
		id: crypto.randomUUID(),
		userId,
		items: watchlistItems,
		createdAt: Date.now(),
	});
}

/**
 * Port of `createDailySnapshots` — iterates users with keyset pagination,
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

		if (batch.length === 0) break;

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
