import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { watchItems } from "../db/schema";
import type { MediaType, ProgressStatus, Reaction } from "../schema/common";

const VALID_PROGRESS_STATUSES: ReadonlySet<string> = new Set([
	"watch-later",
	"watching",
	"done",
	"dropped",
]);

export function normalizeProgressStatus(
	status?: string | null,
): ProgressStatus | undefined {
	if (!status) return undefined;
	return (VALID_PROGRESS_STATUSES.has(status) ? status : undefined) as
		| ProgressStatus
		| undefined;
}

const VALID_REACTIONS: ReadonlySet<string> = new Set([
	"loved",
	"liked",
	"mixed",
	"not-for-me",
	"recommended",
]);

export function normalizeReaction(reaction?: string | null): Reaction | null {
	if (!reaction || typeof reaction !== "string" || reaction.trim() === "") {
		return null;
	}
	return (VALID_REACTIONS.has(reaction) ? reaction : null) as Reaction | null;
}

export interface MediaIdentity {
	tmdbId: number;
	mediaType: MediaType;
}

export type WatchItemMetadata = {
	title?: string | null;
	image?: string | null;
	rating?: number | null;
	release_date?: string | null;
	overview?: string | null;
};

type MetadataDbPatch = {
	title?: string;
	image?: string;
	rating?: number;
	releaseDate?: string;
	overview?: string;
};

export type WatchItemRow = typeof watchItems.$inferSelect;

export async function getWatchItem(
	db: Db,
	userId: string,
	media: MediaIdentity,
): Promise<WatchItemRow | undefined> {
	const rows = await db
		.select()
		.from(watchItems)
		.where(
			and(
				eq(watchItems.userId, userId),
				eq(watchItems.tmdbId, media.tmdbId),
				eq(watchItems.mediaType, media.mediaType),
			),
		)
		.limit(1);
	return rows[0];
}

export function buildMetadataPatch(
	metadata: WatchItemMetadata,
	existing?: WatchItemRow | null,
): MetadataDbPatch {
	const rating =
		typeof metadata.rating === "number" && !Number.isNaN(metadata.rating)
			? Math.min(Math.max(metadata.rating, 0), 10)
			: (existing?.rating ?? undefined);

	return {
		title: metadata.title ?? existing?.title ?? undefined,
		image: metadata.image ?? existing?.image ?? undefined,
		rating,
		releaseDate: metadata.release_date ?? existing?.releaseDate ?? undefined,
		overview: metadata.overview ?? existing?.overview ?? undefined,
	};
}

export type UpsertUpdate =
	| (Partial<Omit<WatchItemRow, "id">> & Partial<WatchItemMetadata>)
	| ((
			existing: WatchItemRow | null,
	  ) =>
			| (Partial<Omit<WatchItemRow, "id">> & Partial<WatchItemMetadata>)
			| null);

/**
 * Port of `upsertWatchItem` — insert or patch the unique (user, tmdb, media)
 * watch item row. Timestamps are always set here (`updatedAt`). Returns the
 * final row so callers can echo the authoritative state back to the client
 * without an extra read.
 */
export async function upsertWatchItem(
	db: Db,
	userId: string,
	tmdbId: number,
	mediaType: MediaType,
	updates: UpsertUpdate,
): Promise<WatchItemRow | undefined> {
	const existing = await getWatchItem(db, userId, { tmdbId, mediaType });
	const finalUpdates =
		typeof updates === "function" ? updates(existing ?? null) : updates;
	if (!finalUpdates) return undefined;

	const now = Date.now();
	const metadataPatch = buildMetadataPatch(finalUpdates, existing);

	if (existing) {
		const patch: Partial<Omit<WatchItemRow, "id">> = {
			updatedAt: now,
			...metadataPatch,
		};
		if ("inWatchlist" in finalUpdates)
			patch.inWatchlist = finalUpdates.inWatchlist;
		if ("progressStatus" in finalUpdates)
			patch.progressStatus =
				normalizeProgressStatus(finalUpdates.progressStatus) ??
				existing.progressStatus;
		if ("progress" in finalUpdates)
			patch.progress =
				typeof finalUpdates.progress === "number"
					? Math.min(Math.max(finalUpdates.progress, 0), 100)
					: existing.progress;
		if ("reaction" in finalUpdates)
			patch.reaction = normalizeReaction(finalUpdates.reaction);

		await db
			.update(watchItems)
			.set(patch)
			.where(eq(watchItems.id, existing.id));
		return { ...existing, ...patch };
	}

	const id = crypto.randomUUID();
	const progressStatus =
		normalizeProgressStatus(finalUpdates.progressStatus) ?? undefined;
	const progress =
		typeof finalUpdates.progress === "number"
			? Math.min(Math.max(finalUpdates.progress, 0), 100)
			: 0;
	const reaction = normalizeReaction(finalUpdates.reaction) ?? undefined;

	const row: WatchItemRow = {
		id,
		userId,
		tmdbId,
		mediaType,
		inWatchlist: finalUpdates.inWatchlist ?? false,
		progressStatus: progressStatus ?? null,
		progress,
		reaction: reaction ?? null,
		title: metadataPatch.title ?? null,
		image: metadataPatch.image ?? null,
		rating: metadataPatch.rating ?? null,
		releaseDate: metadataPatch.releaseDate ?? null,
		overview: metadataPatch.overview ?? null,
		updatedAt: now,
	};

	await db.insert(watchItems).values(row).onConflictDoNothing();
	return row;
}
