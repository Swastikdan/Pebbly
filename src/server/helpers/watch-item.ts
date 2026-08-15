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

export interface MediaIdentity {
	tmdbId: number;
	mediaType: MediaType;
}

export type WatchItemMetadata = {
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
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
	return {
		title: metadata.title ?? existing?.title ?? undefined,
		image: metadata.image ?? existing?.image ?? undefined,
		rating: metadata.rating ?? existing?.rating ?? undefined,
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
 * watch item row. Timestamps are always set here (`updatedAt`).
 */
export async function upsertWatchItem(
	db: Db,
	userId: string,
	tmdbId: number,
	mediaType: MediaType,
	updates: UpsertUpdate,
) {
	const existing = await getWatchItem(db, userId, { tmdbId, mediaType });
	const finalUpdates =
		typeof updates === "function" ? updates(existing ?? null) : updates;
	if (!finalUpdates) return;

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
			patch.progressStatus = finalUpdates.progressStatus;
		if ("progress" in finalUpdates) patch.progress = finalUpdates.progress;
		if ("reaction" in finalUpdates) patch.reaction = finalUpdates.reaction;

		await db
			.update(watchItems)
			.set(patch)
			.where(eq(watchItems.id, existing.id));
		return existing;
	}

	const id = crypto.randomUUID();
	await db.insert(watchItems).values({
		id,
		userId,
		tmdbId,
		mediaType,
		inWatchlist: finalUpdates.inWatchlist ?? false,
		progressStatus: finalUpdates.progressStatus ?? undefined,
		progress: finalUpdates.progress ?? 0,
		reaction: (finalUpdates.reaction as Reaction | undefined) ?? undefined,
		updatedAt: now,
		...metadataPatch,
	});
	return undefined;
}
