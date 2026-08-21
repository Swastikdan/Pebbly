import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";
import { getCurrentUser, requireUser } from "../auth";
import { getDb, runBatch } from "../db/client";
import { episodeProgress, users, watchItems } from "../db/schema";
import { getEnv } from "../env";
import { createWatchlistSnapshot } from "../helpers/snapshots";
import {
	buildMetadataPatch,
	bumpWatchlistRev,
	getWatchItem,
	normalizeProgressStatus,
	upsertWatchItem,
} from "../helpers/watch-item";
import { type ApiResult, ok } from "../schema/common";
import {
	batchSetWatchlistMembershipArgsSchema,
	getWatchlistArgsSchema,
	markEpisodeWatchedArgsSchema,
	markSeasonEpisodesWatchedArgsSchema,
	markShowEpisodesAndStatusArgsSchema,
	mediaIdentityArgsSchema,
	setProgressStatusArgsSchema,
	setReactionArgsSchema,
	setWatchlistMembershipArgsSchema,
	updateProgressArgsSchema,
} from "../schema/watchlist";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getWatchlist = createServerFn({ method: "POST" })
	.validator(getWatchlistArgsSchema)
	.handler(
		async ({
			data,
		}): Promise<ApiResult<(typeof watchItems.$inferSelect)[]>> => {
			const user = await getCurrentUser();
			if (!user) return ok([]);

			const db = getDb(getEnv());
			const requestedLimit =
				data.limit !== undefined && data.limit > 0
					? Math.floor(data.limit)
					: 500;
			const boundedLimit = Math.min(requestedLimit, 500);

			const filters = [eq(watchItems.userId, user.id)];
			if (data.statusFilter) {
				filters.push(
					eq(
						watchItems.progressStatus,
						data.statusFilter as
							| "watch-later"
							| "watching"
							| "done"
							| "dropped",
					),
				);
			}

			const rows = await db
				.select()
				.from(watchItems)
				.where(and(...filters))
				.orderBy(desc(watchItems.updatedAt))
				.limit(boundedLimit);

			return ok(rows);
		},
	);

export const getTrackedTmdbIds = createServerFn({ method: "POST" }).handler(
	async (): Promise<ApiResult<number[]>> => {
		const user = await getCurrentUser();
		if (!user) return ok([]);

		const db = getDb(getEnv());
		const items = await db
			.select({ tmdbId: watchItems.tmdbId })
			.from(watchItems)
			.where(
				and(eq(watchItems.userId, user.id), eq(watchItems.inWatchlist, true)),
			)
			.limit(500);

		return ok(items.map((item) => item.tmdbId));
	},
);

export const getMediaState = createServerFn({ method: "POST" })
	.validator(mediaIdentityArgsSchema)
	.handler(
		async ({
			data,
		}): Promise<ApiResult<typeof watchItems.$inferSelect | null>> => {
			const user = await getCurrentUser();
			if (!user) return ok(null);

			const db = getDb(getEnv());
			const rows = await db
				.select()
				.from(watchItems)
				.where(
					and(
						eq(watchItems.userId, user.id),
						eq(watchItems.tmdbId, data.tmdbId),
						eq(watchItems.mediaType, data.mediaType),
					),
				)
				.limit(1);

			return ok(rows[0] ?? null);
		},
	);

// ---------------------------------------------------------------------------
// Realtime change detection
// ---------------------------------------------------------------------------

/**
 * Cheap (1-row) read clients poll to detect cross-device changes across all
 * user-data domains. Each revision is bumped by the matching mutations
 * (watchlist, custom lists, AI recommendations), so polling this single row
 * is O(1) no matter how large the underlying collections are.
 */
export const getDataVersion = createServerFn({ method: "POST" }).handler(
	async (): Promise<
		ApiResult<{ watchlistRev: number; listsRev: number; aiRev: number }>
	> => {
		const user = await getCurrentUser();
		if (!user) return ok({ watchlistRev: 0, listsRev: 0, aiRev: 0 });

		const db = getDb(getEnv());
		const rows = await db
			.select({
				watchlistRev: users.watchlistRev,
				listsRev: users.listsRev,
				aiRev: users.aiRev,
			})
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1);

		return ok(rows[0] ?? { watchlistRev: 0, listsRev: 0, aiRev: 0 });
	},
);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const updateProgress = createServerFn({ method: "POST" })
	.validator(updateProgressArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const existing = await getWatchItem(db, user.id, {
			tmdbId: data.tmdbId,
			mediaType: data.mediaType,
		});

		const now = Date.now();
		const nextProgress =
			data.isWatched === true
				? 100
				: (data.progress ?? existing?.progress ?? 0);

		const currentProgressStatus = normalizeProgressStatus(
			existing?.progressStatus,
		);

		const inferredProgressStatus =
			data.isWatched === true
				? "done"
				: nextProgress >= 95
					? "done"
					: nextProgress > 0
						? "watching"
						: undefined;

		// An explicit `isWatched: true` always means "done", never let a stale
		// stored status (e.g. "watch-later") shadow it.
		const nextProgressStatus =
			data.isWatched === true
				? "done"
				: (currentProgressStatus ?? inferredProgressStatus);

		if (existing) {
			await db
				.update(watchItems)
				.set({
					progress: nextProgress,
					progressStatus: nextProgressStatus,
					inWatchlist: true,
					updatedAt: now,
					...buildMetadataPatch(data, existing),
				})
				.where(eq(watchItems.id, existing.id));
			await bumpWatchlistRev(db, user.id);
			return ok({ ok: true });
		}

		await db.insert(watchItems).values({
			id: crypto.randomUUID(),
			userId: user.id,
			tmdbId: data.tmdbId,
			mediaType: data.mediaType,
			inWatchlist: true,
			progress: nextProgress,
			progressStatus: nextProgressStatus,
			updatedAt: now,
			...buildMetadataPatch(data),
		});
		await bumpWatchlistRev(db, user.id);
		return ok({ ok: true });
	});

export const removeFromContinueWatching = createServerFn({ method: "POST" })
	.validator(mediaIdentityArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const existing = await getWatchItem(db, user.id, data);
		if (!existing) return ok({ ok: true });

		await db
			.update(watchItems)
			.set({
				// Clear the status for items outside the watchlist; keep
				// "watch-later" when the item is still in it.
				progressStatus: existing.inWatchlist ? "watch-later" : null,
				progress: 0,
				updatedAt: Date.now(),
			})
			.where(eq(watchItems.id, existing.id));

		await bumpWatchlistRev(db, user.id);
		return ok({ ok: true });
	});

export const setWatchlistMembership = createServerFn({ method: "POST" })
	.validator(setWatchlistMembershipArgsSchema)
	.handler(
		async ({
			data,
		}): Promise<ApiResult<typeof watchItems.$inferSelect | null>> => {
			const { user, error } = await requireUser();
			if (error) return error;

			const db = getDb(getEnv());
			const existing = await getWatchItem(db, user.id, {
				tmdbId: data.tmdbId,
				mediaType: data.mediaType,
			});

			if (!data.inWatchlist) {
				if (!existing) return ok(null);

				// If the user has a reaction or non-default progress, keep row with inWatchlist: false
				if (
					existing.reaction ||
					(existing.progress &&
						existing.progress > 0 &&
						existing.progressStatus !== "watch-later")
				) {
					const next = {
						...existing,
						inWatchlist: false,
						progressStatus:
							existing.progressStatus === "watch-later"
								? null
								: existing.progressStatus,
						updatedAt: Date.now(),
					};
					await db
						.update(watchItems)
						.set({
							inWatchlist: false,
							progressStatus: next.progressStatus,
							updatedAt: next.updatedAt,
						})
						.where(eq(watchItems.id, existing.id));
					await bumpWatchlistRev(db, user.id);
					return ok(next);
				}
				// Otherwise, delete the row entirely
				await db.delete(watchItems).where(eq(watchItems.id, existing.id));
				await bumpWatchlistRev(db, user.id);
				return ok(null);
			}

			const row = await upsertWatchItem(
				db,
				user.id,
				data.tmdbId,
				data.mediaType,
				(curr) => {
					const normalizedExisting = curr
						? normalizeProgressStatus(curr.progressStatus)
						: undefined;
					const progressStatus = curr
						? (normalizedExisting ?? "watch-later")
						: "watch-later";

					return {
						inWatchlist: true,
						progressStatus,
						...(curr ? {} : { progress: 0 }),
						title: data.title,
						image: data.image,
						rating: data.rating,
						release_date: data.release_date,
						overview: data.overview,
					};
				},
			);

			return ok(row ?? null);
		},
	);

export const batchSetWatchlistMembership = createServerFn({ method: "POST" })
	.validator(batchSetWatchlistMembershipArgsSchema)
	.handler(
		async ({
			data,
		}): Promise<ApiResult<(typeof watchItems.$inferSelect)[]>> => {
			const { user, error } = await requireUser();
			if (error) return error;

			if (!data.items || data.items.length === 0) {
				return ok([]);
			}

			const db = getDb(getEnv());
			const now = Date.now();

			// Fetch existing watch items for this user in 1 fast query
			const userWatchItems = await db
				.select()
				.from(watchItems)
				.where(eq(watchItems.userId, user.id));

			const existingMap = new Map<string, typeof watchItems.$inferSelect>();
			for (const item of userWatchItems) {
				existingMap.set(`${item.mediaType}:${item.tmdbId}`, item);
			}

			// Deduplicate items in the incoming batch taking the latest state
			const batchMap = new Map<string, (typeof data.items)[number]>();
			for (const item of data.items) {
				batchMap.set(`${item.mediaType}:${item.tmdbId}`, item);
			}

			// Rows that still exist after the write. The client merges these
			// directly into its cache (missing identities were deleted).
			const resultRows: (typeof watchItems.$inferSelect)[] = [];
			const statements: Parameters<typeof db.batch>[0][number][] = [];

			for (const item of batchMap.values()) {
				const existing = existingMap.get(`${item.mediaType}:${item.tmdbId}`);

				if (!item.inWatchlist) {
					if (!existing) continue;

					if (
						existing.reaction ||
						(existing.progress &&
							existing.progress > 0 &&
							existing.progressStatus !== "watch-later")
					) {
						const next = {
							...existing,
							inWatchlist: false,
							progressStatus:
								existing.progressStatus === "watch-later"
									? null
									: existing.progressStatus,
							updatedAt: now,
						};
						statements.push(
							db
								.update(watchItems)
								.set({
									inWatchlist: false,
									progressStatus: next.progressStatus,
									updatedAt: now,
								})
								.where(eq(watchItems.id, existing.id)),
						);
						resultRows.push(next);
					} else {
						statements.push(
							db.delete(watchItems).where(eq(watchItems.id, existing.id)),
						);
					}
					continue;
				}

				const normalizedExisting = existing
					? normalizeProgressStatus(existing.progressStatus)
					: undefined;
				const progressStatus = existing
					? (normalizedExisting ?? "watch-later")
					: "watch-later";
				const metadataPatch = buildMetadataPatch(item, existing ?? undefined);

				if (existing) {
					const patch = {
						inWatchlist: true,
						progressStatus,
						updatedAt: now,
						...metadataPatch,
					};
					statements.push(
						db
							.update(watchItems)
							.set(patch)
							.where(eq(watchItems.id, existing.id)),
					);
					resultRows.push({ ...existing, ...patch });
				} else {
					const row: typeof watchItems.$inferSelect = {
						id: crypto.randomUUID(),
						userId: user.id,
						tmdbId: item.tmdbId,
						mediaType: item.mediaType,
						inWatchlist: true,
						progressStatus: progressStatus ?? null,
						progress: 0,
						reaction: null,
						title: metadataPatch.title ?? null,
						image: metadataPatch.image ?? null,
						rating: metadataPatch.rating ?? null,
						releaseDate: metadataPatch.releaseDate ?? null,
						overview: metadataPatch.overview ?? null,
						updatedAt: now,
					};
					statements.push(
						db.insert(watchItems).values(row).onConflictDoNothing(),
					);
					resultRows.push(row);
				}
			}

			// Execute the whole batch as one transactional round trip instead of
			// one D1 statement per row.
			await runBatch(db, statements);

			await createWatchlistSnapshot(db, user.id);
			await bumpWatchlistRev(db, user.id);
			return ok(resultRows);
		},
	);

export const setProgressStatus = createServerFn({ method: "POST" })
	.validator(setProgressStatusArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		await upsertWatchItem(
			db,
			user.id,
			data.tmdbId,
			data.mediaType,
			(existing) => {
				// data.progressStatus is already validated by progressStatusSchema,
				// so no re-normalization is needed here.
				const normalized = data.progressStatus;
				let nextProgress: number | null | undefined = data.progress;
				if (nextProgress === undefined) {
					if (normalized === "watch-later") nextProgress = 0;
					else if (normalized === "done") nextProgress = 100;
					else nextProgress = existing?.progress ?? null;
				}

				return {
					inWatchlist: true,
					progressStatus: normalized,
					progress: nextProgress,
					title: data.title,
					image: data.image,
					rating: data.rating,
					release_date: data.release_date,
					overview: data.overview,
				};
			},
		);

		return ok({ ok: true });
	});

export const setReaction = createServerFn({ method: "POST" })
	.validator(setReactionArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		await upsertWatchItem(
			db,
			user.id,
			data.tmdbId,
			data.mediaType,
			(existing) => {
				const reaction = data.clearReaction
					? null
					: data.reaction !== undefined
						? data.reaction
						: existing?.reaction;

				return {
					reaction,
					title: data.title,
					image: data.image,
					rating: data.rating,
					release_date: data.release_date,
					overview: data.overview,
				};
			},
		);

		return ok({ ok: true });
	});

// ---------------------------------------------------------------------------
// Episode progress
// ---------------------------------------------------------------------------

type EpisodeSyncArgs = {
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
function buildEpisodeSyncStatements(
	db: ReturnType<typeof getDb>,
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

/** Preload existing episode rows for (user, show), used to batch syncs. */
async function loadEpisodeRowsByKey(
	userId: string,
	tmdbId: number,
): Promise<Map<string, typeof episodeProgress.$inferSelect>> {
	const db = getDb(getEnv());
	const rows = await db
		.select()
		.from(episodeProgress)
		.where(
			and(
				eq(episodeProgress.userId, userId),
				eq(episodeProgress.tmdbId, tmdbId),
			),
		)
		.limit(500);
	return new Map(rows.map((row) => [`${row.season}:${row.episode}`, row]));
}

export async function syncEpisodeProgressRecord(
	userId: string,
	args: EpisodeSyncArgs,
	now: number,
) {
	// Single-row helper kept for markEpisodeWatched; batch paths use
	// buildEpisodeSyncStatements directly.
	const db = getDb(getEnv());
	const existingByKey = await loadEpisodeRowsByKey(userId, args.tmdbId);
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

export const markEpisodeWatched = createServerFn({ method: "POST" })
	.validator(markEpisodeWatchedArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		await syncEpisodeProgressRecord(user.id, data, Date.now());
		return ok({ ok: true });
	});

export const markSeasonEpisodesWatched = createServerFn({ method: "POST" })
	.validator(markSeasonEpisodesWatchedArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const now = Date.now();
		const db = getDb(getEnv());
		const existingByKey = await loadEpisodeRowsByKey(user.id, data.tmdbId);
		const statements: Parameters<typeof db.batch>[0][number][] = [];
		const uniqueEpisodes = Array.from(new Set(data.episodes));
		for (const epNum of uniqueEpisodes) {
			statements.push(
				...buildEpisodeSyncStatements(
					db,
					user.id,
					{
						tmdbId: data.tmdbId,
						season: data.season,
						episode: epNum,
						isWatched: data.isWatched,
					},
					now,
					existingByKey,
				),
			);
		}
		await runBatch(db, statements);
		await bumpWatchlistRev(db, user.id);

		return ok({ ok: true });
	});

export const markShowEpisodesAndStatus = createServerFn({ method: "POST" })
	.validator(markShowEpisodesAndStatusArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const now = Date.now();

		if (data.progressStatus !== undefined) {
			const existing = await getWatchItem(db, user.id, {
				tmdbId: data.tmdbId,
				mediaType: data.mediaType,
			});

			if (existing) {
				await db
					.update(watchItems)
					.set({
						inWatchlist: true,
						progressStatus: data.progressStatus,
						progress: data.progress ?? existing.progress,
						updatedAt: now,
						...buildMetadataPatch(data, existing),
					})
					.where(eq(watchItems.id, existing.id));
			} else {
				await db.insert(watchItems).values({
					id: crypto.randomUUID(),
					userId: user.id,
					tmdbId: data.tmdbId,
					mediaType: data.mediaType,
					inWatchlist: true,
					progressStatus: data.progressStatus,
					progress: data.progress ?? 0,
					updatedAt: now,
					...buildMetadataPatch(data),
				});
			}
		}

		const existingByKey = await loadEpisodeRowsByKey(user.id, data.tmdbId);
		const statements: Parameters<typeof db.batch>[0][number][] = [];

		// Only `clearAllEpisodes` unwatches the entire show. Requests with
		// selected seasons (including isWatched: false) go through the seasons
		// loop so the requested-season scope is preserved.
		if (data.clearAllEpisodes) {
			for (const ep of existingByKey.values()) {
				if (ep.isWatched) {
					statements.push(
						...buildEpisodeSyncStatements(
							db,
							user.id,
							{
								tmdbId: data.tmdbId,
								season: ep.season,
								episode: ep.episode,
								isWatched: false,
							},
							now,
							existingByKey,
						),
					);
				}
			}
		} else {
			for (const seasonData of data.seasons) {
				const uniqueEpisodes = Array.from(new Set(seasonData.episodes));
				for (const epNum of uniqueEpisodes) {
					statements.push(
						...buildEpisodeSyncStatements(
							db,
							user.id,
							{
								tmdbId: data.tmdbId,
								season: seasonData.season,
								episode: epNum,
								isWatched: data.isWatched,
							},
							now,
							existingByKey,
						),
					);
				}
			}
		}

		await runBatch(db, statements);
		await bumpWatchlistRev(db, user.id);

		return ok({ ok: true });
	});

export const getAllWatchedEpisodes = createServerFn({ method: "POST" })
	.validator(
		// matches the Convex `getAllWatchedEpisodes({ tmdbId })` signature
		v.object({ tmdbId: v.number() }),
	)
	.handler(
		async ({
			data,
		}): Promise<ApiResult<(typeof episodeProgress.$inferSelect)[]>> => {
			const user = await getCurrentUser();
			if (!user) return ok([]);

			const db = getDb(getEnv());
			const rows = await db
				.select()
				.from(episodeProgress)
				.where(
					and(
						eq(episodeProgress.userId, user.id),
						eq(episodeProgress.tmdbId, data.tmdbId),
					),
				)
				.limit(500);

			return ok(rows);
		},
	);

export const getAllEpisodeProgress = createServerFn({ method: "POST" }).handler(
	async (): Promise<ApiResult<(typeof episodeProgress.$inferSelect)[]>> => {
		const user = await getCurrentUser();
		if (!user) return ok([]);

		const db = getDb(getEnv());
		const rows = await db
			.select()
			.from(episodeProgress)
			.where(eq(episodeProgress.userId, user.id))
			.limit(500);

		return ok(rows);
	},
);
