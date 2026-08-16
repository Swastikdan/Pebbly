import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as v from "valibot";
import { callGeminiAI, MODELS_TO_TRY, type Recommendation } from "../ai";
import {
	type AuthUser,
	type ClerkSessionClaims,
	getCurrentUser,
	requireUser,
} from "../auth";
import { getDb } from "../db/client";
import {
	aiRecommendations,
	episodeProgress,
	homepageRecommendations,
	listItems,
	lists,
	type Recommendation as RecommendationRow,
	recommendationFeedback,
	watchItems,
} from "../db/schema";
import { getEnv } from "../env";
import {
	buildCustomListPrompt,
	buildGenrePrompt,
	buildHomepageRecommendationsPrompt,
	buildWatchlistPrompt,
	type FeedbackSignals,
	type WatchlistData,
} from "../prompts";
import { hasFeature } from "../rbac";
import { type ApiResult, fail, ok } from "../schema/common";
import {
	deleteRecommendationArgsSchema,
	type GenerateResult,
	generateRecommendationsArgsSchema,
	getHomepageRecommendationsArgsSchema,
	type HomepageRecommendationsResult,
	recommendationsArraySchema,
	removeRecommendationFeedbackArgsSchema,
	setRecommendationFeedbackArgsSchema,
	updateVerifiedRecommendationsArgsSchema,
} from "../schema/recommendations";

const RATE_LIMIT_MS = 2 * 60 * 1000;

const SYSTEM_INSTRUCTION =
	"You are a movie and TV show recommendation engine. You analyze a user's watchlist and viewing preferences to suggest titles they would enjoy. You MUST only recommend real, existing movies and TV shows. Never invent fictional titles. Return your response as a JSON object with the exact schema specified by the user.";

type AuthContext = {
	user: AuthUser;
	claims: ClerkSessionClaims;
	error: null;
};

/** Resolve the user once per request (callers reuse the returned context). */
async function getAuthContext(): Promise<AuthContext | null> {
	const result = await requireUser();
	if (result.error) return null;
	return result;
}

/** Resolve the user + feature gate from one requireUser call. */
async function getAuthUserWithFeature(): Promise<
	{ user: AuthUser; claims: ClerkSessionClaims } | { error: ApiResult<never> }
> {
	const context = await getAuthContext();
	if (!context) return { error: fail("UNAUTHORIZED", "Unauthorized") };
	const allowed = await hasFeature(
		context.claims,
		context.user,
		"ai-recommendations",
	);
	if (!allowed) {
		return { error: fail("FORBIDDEN", "Unauthorized: feature not enabled") };
	}
	return { user: context.user, claims: context.claims };
}

// ---------------------------------------------------------------------------
// Access / history
// ---------------------------------------------------------------------------

export const getUserRecommendationAccess = createServerFn({
	method: "POST",
}).handler(
	async (): Promise<
		ApiResult<
			| { hasAccess: true }
			| { hasAccess: false; reason: "not_authenticated" | "feature_disabled" }
		>
	> => {
		const context = await getAuthContext();
		if (!context) {
			return ok({ hasAccess: false, reason: "not_authenticated" });
		}
		const allowed = await hasFeature(
			context.claims,
			context.user,
			"ai-recommendations",
		);
		if (!allowed) {
			return ok({ hasAccess: false, reason: "feature_disabled" });
		}
		return ok({ hasAccess: true });
	},
);

export const getRecommendationHistory = createServerFn({
	method: "POST",
}).handler(
	async (): Promise<ApiResult<(typeof aiRecommendations.$inferSelect)[]>> => {
		const context = await getAuthContext();
		if (!context) return ok([]);
		const allowed = await hasFeature(
			context.claims,
			context.user,
			"ai-recommendations",
		);
		if (!allowed) return ok([]);

		const db = getDb(getEnv());
		const rows = await db
			.select()
			.from(aiRecommendations)
			.where(eq(aiRecommendations.userId, context.user.id))
			.orderBy(desc(aiRecommendations.createdAt))
			.limit(20);

		return ok(rows);
	},
);

export const deleteRecommendation = createServerFn({ method: "POST" })
	.validator(deleteRecommendationArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const entry = await db
			.select()
			.from(aiRecommendations)
			// Scope the read to the authenticated user so ownership is enforced
			// by the query itself, not a follow-up check.
			.where(
				and(
					eq(aiRecommendations.id, data.id),
					eq(aiRecommendations.userId, user.id),
				),
			)
			.limit(1);
		if (entry.length === 0) return fail("NOT_FOUND", "Not found");

		await db
			.delete(aiRecommendations)
			.where(
				and(
					eq(aiRecommendations.id, data.id),
					eq(aiRecommendations.userId, user.id),
				),
			);
		return ok({ ok: true });
	});

export const updateVerifiedRecommendations = createServerFn({ method: "POST" })
	.validator(updateVerifiedRecommendationsArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		// Validate the recommendations payload before constructing the patch;
		// a malformed payload is a client error, not a server crash.
		let parsedRecommendations: unknown;
		try {
			parsedRecommendations = JSON.parse(data.recommendations);
		} catch {
			return fail("BAD_REQUEST", "Invalid recommendations payload");
		}
		const validated = v.safeParse(
			recommendationsArraySchema,
			parsedRecommendations,
		);
		if (!validated.success) {
			return fail("BAD_REQUEST", "Invalid recommendations payload");
		}

		const db = getDb(getEnv());
		const entry = await db
			.select()
			.from(aiRecommendations)
			.where(
				and(
					eq(aiRecommendations.id, data.id),
					eq(aiRecommendations.userId, user.id),
				),
			)
			.limit(1);
		if (entry.length === 0) return fail("NOT_FOUND", "Not found");

		const patch: Partial<typeof aiRecommendations.$inferSelect> = {
			recommendations: validated.output,
			verified: true,
		};
		if (!entry[0].originalRecommendations) {
			patch.originalRecommendations = entry[0].recommendations;
		}

		await db
			.update(aiRecommendations)
			.set(patch)
			.where(
				and(
					eq(aiRecommendations.id, data.id),
					eq(aiRecommendations.userId, user.id),
				),
			);
		return ok({ ok: true });
	});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export const getRecommendationFeedback = createServerFn({
	method: "POST",
}).handler(
	async (): Promise<
		ApiResult<(typeof recommendationFeedback.$inferSelect)[]>
	> => {
		const user = await getCurrentUser();
		if (!user) return ok([]);

		const db = getDb(getEnv());
		const rows = await db
			.select()
			.from(recommendationFeedback)
			.where(eq(recommendationFeedback.userId, user.id))
			.limit(100);

		return ok(rows);
	},
);

export const setRecommendationFeedback = createServerFn({ method: "POST" })
	.validator(setRecommendationFeedbackArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const now = Date.now();

		const existing = await db
			.select()
			.from(recommendationFeedback)
			.where(
				and(
					eq(recommendationFeedback.userId, user.id),
					eq(recommendationFeedback.tmdbId, data.tmdbId),
					eq(recommendationFeedback.mediaType, data.mediaType),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			await db
				.update(recommendationFeedback)
				.set({ feedback: data.feedback, updatedAt: now })
				.where(eq(recommendationFeedback.id, existing[0].id));
		} else {
			await db.insert(recommendationFeedback).values({
				id: crypto.randomUUID(),
				userId: user.id,
				tmdbId: data.tmdbId,
				mediaType: data.mediaType,
				title: data.title,
				feedback: data.feedback,
				updatedAt: now,
			});
		}

		// When user likes a recommendation, auto-add to watchlist with
		// "recommended" reaction & Pebbly Picks list.
		if (data.feedback === "like") {
			const existingWatchItem = await db
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

			if (existingWatchItem.length > 0) {
				await db
					.update(watchItems)
					.set({
						inWatchlist: true,
						reaction: existingWatchItem[0].reaction ?? "recommended",
						updatedAt: now,
					})
					.where(eq(watchItems.id, existingWatchItem[0].id));
			} else {
				await db.insert(watchItems).values({
					id: crypto.randomUUID(),
					userId: user.id,
					tmdbId: data.tmdbId,
					mediaType: data.mediaType,
					inWatchlist: true,
					progressStatus: "watch-later",
					reaction: "recommended",
					title: data.title,
					image: data.image,
					rating: data.rating,
					releaseDate: data.release_date,
					overview: data.overview,
					updatedAt: now,
				});
			}

			// Find or create the Pebbly Picks list — onConflictDoNothing makes
			// the create race-safe against the (userId, name) unique index, then
			// one lookup returns the authoritative row.
			await db
				.insert(lists)
				.values({
					id: crypto.randomUUID(),
					userId: user.id,
					name: "Pebbly Picks",
					listType: "pebbly-picks",
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoNothing();

			const pebblyList = await db
				.select()
				.from(lists)
				.where(and(eq(lists.userId, user.id), eq(lists.name, "Pebbly Picks")))
				.limit(1);

			if (pebblyList.length > 0) {
				const existingItem = await db
					.select()
					.from(listItems)
					.where(
						and(
							eq(listItems.listId, pebblyList[0].id),
							eq(listItems.tmdbId, data.tmdbId),
							eq(listItems.mediaType, data.mediaType),
						),
					)
					.limit(1);

				if (existingItem.length === 0) {
					await db.insert(listItems).values({
						id: crypto.randomUUID(),
						userId: user.id,
						listId: pebblyList[0].id,
						tmdbId: data.tmdbId,
						mediaType: data.mediaType,
						addedAt: now,
						title: data.title,
						image: data.image,
						backdrop: data.backdrop,
						rating: data.rating,
						releaseDate: data.release_date,
						overview: data.overview,
					});
				}
			}
		}

		return ok({ ok: true });
	});

export const removeRecommendationFeedback = createServerFn({ method: "POST" })
	.validator(removeRecommendationFeedbackArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const { user, error } = await requireUser();
		if (error) return error;

		const db = getDb(getEnv());
		const existing = await db
			.select()
			.from(recommendationFeedback)
			.where(
				and(
					eq(recommendationFeedback.userId, user.id),
					eq(recommendationFeedback.tmdbId, data.tmdbId),
					eq(recommendationFeedback.mediaType, data.mediaType),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			await db
				.delete(recommendationFeedback)
				.where(eq(recommendationFeedback.id, existing[0].id));
		}

		return ok({ ok: true });
	});

// ---------------------------------------------------------------------------
// Homepage recommendations
// ---------------------------------------------------------------------------

export const getHomepageRecommendations = createServerFn({ method: "POST" })
	.validator(getHomepageRecommendationsArgsSchema)
	.handler(async (): Promise<ApiResult<HomepageRecommendationsResult>> => {
		// Resolve the user once (without creating one on the read path).
		const context = await getAuthContext();
		if (!context) {
			return ok({
				recommendations: [],
				lastUpdatedAt: 0,
				lastAttemptedAt: 0,
				status: "none",
				needsRefresh: false,
			});
		}
		const user = context.user;

		// Only request a refresh when the user actually has the feature.
		// Otherwise the client would keep firing generateHomepageRecommendations
		// (which the server rejects with FORBIDDEN) on every refetch — a loop.
		const featureEnabled = await hasFeature(
			context.claims,
			context.user,
			"ai-recommendations",
		);

		const db = getDb(getEnv());
		const entry = await db
			.select()
			.from(homepageRecommendations)
			.where(eq(homepageRecommendations.userId, user.id))
			.limit(1);

		// One query covering both exclusion feedback values instead of two.
		const excludedFeedback = await db
			.select()
			.from(recommendationFeedback)
			.where(
				and(
					eq(recommendationFeedback.userId, user.id),
					inArray(recommendationFeedback.feedback, [
						"not_interested",
						"dislike",
					]),
				),
			);

		const excludedFeedbackIds = new Set(excludedFeedback.map((f) => f.tmdbId));

		let recs: Recommendation[] = [];
		const row = entry[0];
		if (row && row.recommendations) {
			try {
				const parsed = Array.isArray(row.recommendations)
					? row.recommendations
					: (JSON.parse(row.recommendations) as Recommendation[]);
				recs = parsed.filter(
					(r) => r.tmdbId === null || !excludedFeedbackIds.has(r.tmdbId),
				);
			} catch (e) {
				console.error("Failed to parse homepage recommendations", e);
			}
		}

		const lastAttemptedAt = row?.lastAttemptedAt ?? 0;
		const lastUpdatedAt = row?.lastUpdatedAt ?? 0;
		const status = row?.status ?? "none";

		// Refresh gating uses server-derived time exclusively; the client-
		// supplied `now` is only used for display-related behavior.
		const currentTime = Date.now();
		const isOlderThan24Hours =
			currentTime - lastAttemptedAt > 24 * 60 * 60 * 1000;
		const hasFailedRecently =
			status === "failed" && currentTime - lastAttemptedAt < 1 * 60 * 60 * 1000;
		const needsRefresh =
			featureEnabled && (!row || (isOlderThan24Hours && !hasFailedRecently));

		return ok({
			recommendations: recs,
			lastUpdatedAt,
			lastAttemptedAt,
			status,
			needsRefresh,
		});
	});

// ---------------------------------------------------------------------------
// Generation helpers (private — no longer separate RPCs)
// ---------------------------------------------------------------------------

function computeHash(
	items: Array<{
		tmdbId: number;
		progressStatus?: string | null;
		reaction?: string | null;
	}>,
	mediaTypePreference?: string,
	genrePreference?: string,
): string {
	const sorted = items
		.map((i) => `${i.tmdbId}:${i.progressStatus ?? ""}:${i.reaction ?? ""}`)
		.sort();
	let hash = 0;
	const str =
		sorted.join("|") +
		`|mt:${mediaTypePreference ?? ""}|g:${genrePreference ?? ""}`;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return hash.toString(36);
}

function normalizeTitleKey(title?: string | null): string {
	return (title ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function gatherWatchlistData(userId: string): Promise<WatchlistData> {
	const db = getDb(getEnv());
	// Execute the four independent reads in one batched round trip.
	const [watchItemRows, listRows, listItemRows, episodeRows] = await db.batch([
		db
			.select()
			.from(watchItems)
			.where(eq(watchItems.userId, userId))
			.orderBy(desc(watchItems.updatedAt))
			.limit(200),
		db.select().from(lists).where(eq(lists.userId, userId)).limit(50),
		db
			.select()
			.from(listItems)
			.where(eq(listItems.userId, userId))
			.orderBy(desc(listItems.addedAt))
			.limit(200),
		db
			.select()
			.from(episodeProgress)
			.where(eq(episodeProgress.userId, userId))
			.orderBy(desc(episodeProgress.updatedAt))
			.limit(200),
	]);

	const watchedEpisodes = episodeRows.filter((e) => e.isWatched).length;
	const movieCount = watchItemRows.filter(
		(i) => i.mediaType === "movie",
	).length;
	const tvCount = watchItemRows.filter((i) => i.mediaType === "tv").length;

	return {
		watchItems: watchItemRows.map((i) => ({
			tmdbId: i.tmdbId,
			mediaType: i.mediaType,
			title: i.title,
			rating: i.rating,
			progressStatus: i.progressStatus,
			reaction: i.reaction,
			progress: i.progress,
		})),
		lists: listRows.map((l) => ({ _id: l.id, name: l.name })),
		listItems: listItemRows.map((li) => ({
			listId: li.listId,
			tmdbId: li.tmdbId,
			mediaType: li.mediaType,
		})),
		inputStats: {
			movieCount,
			tvCount,
			episodesWatched: watchedEpisodes,
			totalItems: watchItemRows.length,
		},
	};
}

async function getRecommendationFeedbackInternal(userId: string) {
	const db = getDb(getEnv());
	return db
		.select()
		.from(recommendationFeedback)
		.where(eq(recommendationFeedback.userId, userId))
		.limit(100);
}

/**
 * Atomically reserve a generation slot: inserts a reserved row (the cooldown
 * marker) and returns its id. The successful generation later updates this
 * same row, so no separate placeholder pollutes the recommendation history;
 * a failed AI call deletes it, releasing the cooldown. The insert itself is
 * atomic so concurrent requests cannot both pass the check.
 */
async function checkAndSetRecommendationCooldown(
	userId: string,
): Promise<{ allowed: boolean; reservedId?: string }> {
	const db = getDb(getEnv());
	const now = Date.now();

	const reservedId = crypto.randomUUID();
	const inserted = await db
		.insert(aiRecommendations)
		.values({
			id: reservedId,
			userId,
			recommendations: [],
			watchlistHash: "",
			inputStats: {
				movieCount: 0,
				tvCount: 0,
				episodesWatched: 0,
				totalItems: 0,
			},
			model: "pending",
			createdAt: now,
		})
		.onConflictDoNothing()
		.returning({ id: aiRecommendations.id });

	// Rate limit: if the user already has a generation newer than RATE_LIMIT_MS
	// (either a real one or a pending reservation), reject. The check runs
	// after the reservation insert so a rapid second request sees the pending
	// row and is rejected; the reservation row is then removed below.
	const mostRecent = await db
		.select()
		.from(aiRecommendations)
		.where(eq(aiRecommendations.userId, userId))
		.orderBy(desc(aiRecommendations.createdAt))
		.limit(2);

	const freshRow = mostRecent.find((row) => row.id === reservedId);
	if (!freshRow && inserted.length === 0) {
		// Insert failed (unlikely) — treat as not allowed.
		return { allowed: false };
	}

	// The reservation is always the newest row we just inserted; if there is an
	// older row within the window, reject and clean up the reservation.
	const older = mostRecent.find((row) => row.id !== reservedId);
	if (older && now - older.createdAt < RATE_LIMIT_MS) {
		await db
			.delete(aiRecommendations)
			.where(eq(aiRecommendations.id, reservedId));
		return { allowed: false };
	}

	return { allowed: true, reservedId };
}

/** Delete a reserved generation row (AI call failed — release the cooldown). */
async function releaseRecommendationCooldown(reservedId: string) {
	const db = getDb(getEnv());
	await db
		.delete(aiRecommendations)
		.where(eq(aiRecommendations.id, reservedId));
}

async function getHomepageAttemptInfo(userId: string) {
	const db = getDb(getEnv());
	const entry = await db
		.select()
		.from(homepageRecommendations)
		.where(eq(homepageRecommendations.userId, userId))
		.limit(1);
	return entry.length > 0
		? { lastAttemptedAt: entry[0].lastAttemptedAt, status: entry[0].status }
		: null;
}

async function getHomepageRecommendationEntryInternal(userId: string) {
	const db = getDb(getEnv());
	const entry = await db
		.select()
		.from(homepageRecommendations)
		.where(eq(homepageRecommendations.userId, userId))
		.limit(1);
	return entry.length > 0 ? entry[0] : null;
}

type SaveRecommendationsArgs = {
	userId: string;
	recommendations: RecommendationRow[];
	watchlistHash: string;
	inputStats: {
		movieCount: number;
		tvCount: number;
		episodesWatched: number;
		totalItems: number;
	};
	model: string;
	mediaTypePreference?: "movie" | "tv";
	genrePreference?: string;
	generationType?: string;
};

/**
 * Persist a generation. When `reservedId` is present the pending reservation
 * row (created by checkAndSetRecommendationCooldown) is updated in place, so
 * the history contains one row per generation — never a placeholder.
 */
async function saveRecommendations(
	args: SaveRecommendationsArgs,
	reservedId?: string,
) {
	const db = getDb(getEnv());
	const now = Date.now();
	const values = {
		recommendations: args.recommendations,
		watchlistHash: args.watchlistHash,
		inputStats: args.inputStats,
		model: args.model,
		mediaTypePreference: args.mediaTypePreference,
		genrePreference: args.genrePreference,
		generationType: args.generationType,
		createdAt: now,
	};

	if (reservedId) {
		await db
			.update(aiRecommendations)
			.set(values)
			.where(eq(aiRecommendations.id, reservedId));
	} else {
		await db.insert(aiRecommendations).values({
			id: crypto.randomUUID(),
			userId: args.userId,
			...values,
		});
	}
}

/** Upsert the homepage recommendations row keyed on the unique userId. */
async function saveHomepageRecommendations(
	userId: string,
	recommendations: RecommendationRow[],
) {
	const db = getDb(getEnv());
	const now = Date.now();
	// userId-keyed upsert: the previous recommendations are preserved from the
	// existing row (excluded from the conflict set).
	await db
		.insert(homepageRecommendations)
		.values({
			id: crypto.randomUUID(),
			userId,
			recommendations,
			lastAttemptedAt: now,
			lastUpdatedAt: now,
			status: "success",
		})
		.onConflictDoUpdate({
			target: homepageRecommendations.userId,
			set: {
				previousRecommendations: sql`${homepageRecommendations.recommendations}`,
				recommendations,
				lastAttemptedAt: now,
				lastUpdatedAt: now,
				status: "success",
			},
		});
}

/** Upsert the homepage failure state keyed on the unique userId. */
async function saveHomepageFailure(userId: string) {
	const db = getDb(getEnv());
	const now = Date.now();
	await db
		.insert(homepageRecommendations)
		.values({
			id: crypto.randomUUID(),
			userId,
			recommendations: [],
			lastAttemptedAt: now,
			lastUpdatedAt: 0,
			status: "failed",
		})
		.onConflictDoUpdate({
			target: homepageRecommendations.userId,
			set: { lastAttemptedAt: now, status: "failed" },
		});
}

// ---------------------------------------------------------------------------
// generateRecommendations (action → server fn)
// ---------------------------------------------------------------------------
export const generateRecommendations = createServerFn({ method: "POST" })
	.validator(generateRecommendationsArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<GenerateResult>> => {
		const genType = data.generationType ?? "watchlist";

		// Resolve auth + feature once and reuse.
		const auth = await getAuthUserWithFeature();
		if ("error" in auth) return auth.error;
		const user = auth.user;

		// A `list` generation without a listId is a client error.
		if (genType === "list" && !data.listId) {
			return fail("BAD_REQUEST", "listId is required for list generation");
		}

		const watchlistData = await gatherWatchlistData(user.id);

		if (genType === "watchlist" && watchlistData.watchItems.length === 0) {
			return ok({ error: "empty_watchlist" });
		}
		if (genType === "list" && data.listId) {
			if (
				watchlistData.listItems.filter((li) => li.listId === data.listId)
					.length === 0
			) {
				return ok({ error: "empty_watchlist" });
			}
		}

		const { allowed, reservedId } = await checkAndSetRecommendationCooldown(
			user.id,
		);
		if (!allowed) {
			return ok({ error: "rate_limited" });
		}

		const feedbackList = await getRecommendationFeedbackInternal(user.id);

		const likedTitles = feedbackList
			.filter((f) => f.feedback === "like")
			.map((f) => f.title);
		const dislikedTitles = feedbackList
			.filter((f) => f.feedback === "not_interested")
			.map((f) => f.title);
		const dislikedTmdbIds = feedbackList
			.filter((f) => f.feedback === "not_interested")
			.map((f) => f.tmdbId);

		const excludeTmdbIds = [
			...new Set([...(data.excludeTmdbIds ?? []), ...dislikedTmdbIds]),
		];

		const feedbackSignals: FeedbackSignals = {
			likedTitles,
			dislikedTitles,
			dislikedTmdbIds,
		};

		const userPrompt =
			genType === "watchlist"
				? buildWatchlistPrompt(
						watchlistData,
						data.mediaTypePreference,
						excludeTmdbIds,
						data.yearFrom,
						data.yearTo,
						data.count,
						feedbackSignals,
					)
				: genType === "list" && data.listId
					? buildCustomListPrompt(
							watchlistData,
							data.listId,
							data.mediaTypePreference,
							excludeTmdbIds,
							data.yearFrom,
							data.yearTo,
							data.count,
							feedbackSignals,
						)
					: buildGenrePrompt(
							watchlistData,
							data.mediaTypePreference,
							data.genrePreference,
							excludeTmdbIds,
							data.yearFrom,
							data.yearTo,
							data.count,
							feedbackSignals,
						);

		const aiResult = await callGeminiAI(userPrompt, SYSTEM_INSTRUCTION, 1);
		if (aiResult.error || !aiResult.result) {
			// Release the cooldown so a failed AI call does not consume it.
			if (reservedId) await releaseRecommendationCooldown(reservedId);
			return ok({ error: aiResult.error ?? "api_unavailable" });
		}
		const parsed = aiResult.result;
		const usedModel = aiResult.usedModel ?? MODELS_TO_TRY[0];

		const existingIds = new Set([
			...watchlistData.watchItems.map((item) => item.tmdbId),
			...excludeTmdbIds,
		]);
		const existingTitles = new Set(
			watchlistData.watchItems.map((item) => normalizeTitleKey(item.title)),
		);
		parsed.recommendations = parsed.recommendations.filter(
			(r) =>
				(r.tmdbId == null || !existingIds.has(r.tmdbId)) &&
				!existingTitles.has(normalizeTitleKey(r.title)),
		);

		const watchlistHash = computeHash(
			watchlistData.watchItems,
			data.mediaTypePreference,
			data.genrePreference,
		);
		await saveRecommendations(
			{
				userId: user.id,
				recommendations: parsed.recommendations,
				watchlistHash,
				inputStats: watchlistData.inputStats,
				model: usedModel,
				mediaTypePreference: data.mediaTypePreference,
				genrePreference: data.genrePreference,
				generationType: genType,
			},
			reservedId,
		);

		return ok({
			recommendations: parsed.recommendations,
			inputStats: watchlistData.inputStats,
			generatedAt: Date.now(),
			cached: false,
		});
	});

// ---------------------------------------------------------------------------
// generateHomepageRecommendations (action → server fn)
// ---------------------------------------------------------------------------

export const generateHomepageRecommendations = createServerFn({
	method: "POST",
}).handler(
	async (): Promise<ApiResult<{ success: boolean; error?: string }>> => {
		// Resolve auth + feature once and reuse.
		const auth = await getAuthUserWithFeature();
		if ("error" in auth) return auth.error;
		const user = auth.user;

		const watchlistData = await gatherWatchlistData(user.id);

		const attemptInfo = await getHomepageAttemptInfo(user.id);
		if (
			attemptInfo &&
			Date.now() - attemptInfo.lastAttemptedAt < RATE_LIMIT_MS
		) {
			return ok({ success: false, error: "rate_limited" });
		}

		const feedbackList = await getRecommendationFeedbackInternal(user.id);

		const likedFeedback = feedbackList
			.filter((f) => f.feedback === "like")
			.map((f) => f.title);

		const dislikedFeedbackTitles = feedbackList
			.filter(
				(f) => f.feedback === "not_interested" || f.feedback === "dislike",
			)
			.map((f) => f.title);

		const dislikedFeedbackIds = feedbackList
			.filter(
				(f) => f.feedback === "not_interested" || f.feedback === "dislike",
			)
			.map((f) => f.tmdbId);

		const homepageEntry = await getHomepageRecommendationEntryInternal(user.id);

		let previousTitles: string[] = [];
		let previousTmdbIds: number[] = [];
		if (homepageEntry?.recommendations) {
			try {
				const prevRecs = Array.isArray(homepageEntry.recommendations)
					? homepageEntry.recommendations
					: (JSON.parse(homepageEntry.recommendations) as Recommendation[]);
				previousTitles = prevRecs.map((r) => r.title);
				previousTmdbIds = prevRecs
					.map((r) => r.tmdbId)
					.filter((id): id is number => typeof id === "number");
			} catch {
				// ignore parse error
			}
		}

		const prompt = buildHomepageRecommendationsPrompt(
			watchlistData,
			likedFeedback,
			dislikedFeedbackTitles,
			[...dislikedFeedbackIds, ...previousTmdbIds],
			previousTitles,
		);

		const aiResult = await callGeminiAI(prompt, SYSTEM_INSTRUCTION, 2);
		if (aiResult.error || !aiResult.result) {
			await saveHomepageFailure(user.id);
			return ok({ success: false, error: aiResult.error ?? "api_unavailable" });
		}
		const parsed = aiResult.result;

		const existingIds = new Set([
			...watchlistData.watchItems.map((item) => item.tmdbId),
			...dislikedFeedbackIds,
		]);
		const existingTitles = new Set(
			watchlistData.watchItems.map((item) => normalizeTitleKey(item.title)),
		);

		parsed.recommendations = parsed.recommendations.filter(
			(r) =>
				(r.tmdbId == null || !existingIds.has(r.tmdbId)) &&
				!existingTitles.has(normalizeTitleKey(r.title)),
		);

		// An empty result after filtering is a failed generation — record the
		// failure so refresh logic can retry instead of saving "success".
		if (parsed.recommendations.length === 0) {
			await saveHomepageFailure(user.id);
			return ok({ success: false, error: "empty_result" });
		}

		await saveHomepageRecommendations(user.id, parsed.recommendations);

		return ok({ success: true });
	},
);
