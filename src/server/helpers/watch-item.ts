import { and, eq, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import type { MediaType, ProgressStatus, Reaction } from "../schema/common";
import { users, watchItems } from "../db/schema";
import { PROGRESS_STATUSES, REACTIONS } from "../schema/common";

const VALID_PROGRESS_STATUSES: ReadonlySet<string> = new Set(PROGRESS_STATUSES);

export function normalizeProgressStatus(
  status?: string | null,
): ProgressStatus | undefined {
  if (!status) return undefined;
  return (VALID_PROGRESS_STATUSES.has(status) ? status : undefined) as
    ProgressStatus | undefined;
}

const VALID_REACTIONS: ReadonlySet<string> = new Set(REACTIONS);

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

export type UserRevColumn = "watchlistRev" | "listsRev" | "aiRev" | "permsRev";

// SQL increment descriptors are immutable, so one shared instance per column.
const REV_COLUMN_PATCH: Record<UserRevColumn, Record<string, unknown>> = {
  watchlistRev: { watchlistRev: sql`${users.watchlistRev} + 1` },
  listsRev: { listsRev: sql`${users.listsRev} + 1` },
  aiRev: { aiRev: sql`${users.aiRev} + 1` },
  permsRev: { permsRev: sql`${users.permsRev} + 1` },
};

export async function bumpUserRev(
  db: Db,
  userId: string,
  column: UserRevColumn,
): Promise<void> {
  await db
    .update(users)
    .set(REV_COLUMN_PATCH[column])
    .where(eq(users.id, userId));
}

export const bumpWatchlistRev = (db: Db, userId: string) =>
  bumpUserRev(db, userId, "watchlistRev");

export const bumpListsRev = (db: Db, userId: string) =>
  bumpUserRev(db, userId, "listsRev");

export const bumpAiRev = (db: Db, userId: string) =>
  bumpUserRev(db, userId, "aiRev");

export const bumpPermsRev = (db: Db, userId: string) =>
  bumpUserRev(db, userId, "permsRev");

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

export type MembershipRemovalPlan =
  { delete: true } | { delete: false; nextRow: WatchItemRow };

export function planMembershipRemoval(
  existing: WatchItemRow,
  now: number,
): MembershipRemovalPlan {
  const hasAttachment =
    existing.reaction ||
    (existing.progress &&
      existing.progress > 0 &&
      existing.progressStatus !== "watch-later");
  if (!hasAttachment) return { delete: true };
  return {
    delete: false,
    nextRow: {
      ...existing,
      inWatchlist: false,
      progressStatus:
        existing.progressStatus === "watch-later"
          ? null
          : existing.progressStatus,
      updatedAt: now,
    },
  };
}

export type UpsertUpdate =
  | (Partial<Omit<WatchItemRow, "id">> & Partial<WatchItemMetadata>)
  | ((
      existing: WatchItemRow | null,
    ) =>
      (Partial<Omit<WatchItemRow, "id">> & Partial<WatchItemMetadata>) | null);

export interface UpsertWatchItemOptions {
  /**
   * Skip the internal watchlistRev bump for callers that write several
   * domains in one operation and bump exactly once themselves (e.g.
   * markShowEpisodesAndStatus), so the operation never double-bumps.
   */
  skipRevBump?: boolean;
}

export async function upsertWatchItem(
  db: Db,
  userId: string,
  tmdbId: number,
  mediaType: MediaType,
  updates: UpsertUpdate,
  options: UpsertWatchItemOptions = {},
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
    if (!options.skipRevBump) await bumpWatchlistRev(db, userId);
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

  // If a concurrent request inserts the same (user, tmdb, media) row between
  // our read and our insert, apply this request's state changes to the
  // winner's row instead of silently discarding them (onConflictDoNothing
  // would drop the callback's updates). Only fields the callback explicitly
  // provided are written; `undefined` values are omitted by Drizzle, so the
  // winner's metadata/state is preserved where this request had no opinion.
  const conflictSet: Partial<Omit<WatchItemRow, "id">> = {};
  if ("inWatchlist" in finalUpdates) conflictSet.inWatchlist = row.inWatchlist;
  if ("progressStatus" in finalUpdates)
    conflictSet.progressStatus = progressStatus ?? null;
  if ("progress" in finalUpdates) conflictSet.progress = row.progress;
  if ("reaction" in finalUpdates) conflictSet.reaction = reaction ?? null;
  conflictSet.title = metadataPatch.title ?? undefined;
  conflictSet.image = metadataPatch.image ?? undefined;
  conflictSet.rating = metadataPatch.rating ?? undefined;
  conflictSet.releaseDate = metadataPatch.releaseDate ?? undefined;
  conflictSet.overview = metadataPatch.overview ?? undefined;
  conflictSet.updatedAt = now;

  await db
    .insert(watchItems)
    .values(row)
    .onConflictDoUpdate({
      target: [watchItems.userId, watchItems.tmdbId, watchItems.mediaType],
      set: conflictSet,
    });

  // On conflict the update may have merged with the winner's metadata, so
  // re-read the authoritative row rather than trusting our pre-insert value.
  const refreshed = await getWatchItem(db, userId, { tmdbId, mediaType });
  if (!options.skipRevBump) await bumpWatchlistRev(db, userId);
  return refreshed ?? row;
}
