import { type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";

export type WatchlistContext = QueryCtx | MutationCtx;
export type WatchlistUser = Doc<"users">;
export type WatchItem = Doc<"watch_items">;
export type EpisodeProgress = Doc<"episode_progress">;

export type MediaType = "movie" | "tv";

export const MEDIA_TYPE_VALIDATOR = v.union(v.literal("movie"), v.literal("tv"));

export type MediaIdentity = {
  tmdbId: number;
  mediaType: MediaType;
};

export type WatchItemMetadata = {
  title?: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

const VALID_PROGRESS_STATUSES: ReadonlySet<string> = new Set([
  "watch-later",
  "watching",
  "done",
  "dropped",
]);

export const PROGRESS_STATUS_VALIDATOR = v.union(
  v.literal("watch-later"),
  v.literal("watching"),
  v.literal("done"),
  v.literal("dropped"),
);

export const REACTION_VALIDATOR = v.union(
  v.literal("loved"),
  v.literal("liked"),
  v.literal("mixed"),
  v.literal("not-for-me"),
  v.literal("recommended"),
);

export const REACTION_OR_NULL_VALIDATOR = v.union(REACTION_VALIDATOR, v.null());

export function normalizeProgressStatus(status?: string): string | undefined {
  if (!status) return undefined;
  return VALID_PROGRESS_STATUSES.has(status) ? status : undefined;
}

export async function getCurrentUser(ctx: WatchlistContext) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
    .first();
}

export async function requireCurrentUser(ctx: WatchlistContext): Promise<WatchlistUser> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function getWatchItem(
  ctx: WatchlistContext,
  userId: WatchlistUser["_id"],
  media: MediaIdentity,
) {
  return ctx.db
    .query("watch_items")
    .withIndex("by_user_media", (q) =>
      q
        .eq("userId", userId)
        .eq("tmdbId", media.tmdbId)
        .eq("mediaType", media.mediaType),
    )
    .first();
}

export function buildMetadataPatch(
  metadata: WatchItemMetadata,
  existing?: WatchItem,
): WatchItemMetadata {
  return {
    title: metadata.title ?? existing?.title,
    image: metadata.image ?? existing?.image,
    rating: metadata.rating ?? existing?.rating,
    release_date: metadata.release_date ?? existing?.release_date,
    overview: metadata.overview ?? existing?.overview,
  };
}

export async function upsertWatchItem(
  ctx: MutationCtx,
  userId: WatchlistUser["_id"],
  tmdbId: number,
  mediaType: MediaType,
  updates: Partial<WatchItem> | ((existing: WatchItem | null) => Partial<WatchItem> | null)
) {
  const existing = await getWatchItem(ctx, userId, { tmdbId, mediaType });
  const finalUpdates = typeof updates === "function" ? updates(existing) : updates;
  if (!finalUpdates) return;

  const now = Date.now();
  const metadataPatch = buildMetadataPatch(finalUpdates, existing ?? undefined);

  if (existing) {
    const patch: any = { updatedAt: now, ...metadataPatch };
    if ("inWatchlist" in finalUpdates) patch.inWatchlist = finalUpdates.inWatchlist;
    if ("progressStatus" in finalUpdates) patch.progressStatus = finalUpdates.progressStatus;
    if ("progress" in finalUpdates) patch.progress = finalUpdates.progress;
    if ("reaction" in finalUpdates) patch.reaction = finalUpdates.reaction;

    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("watch_items", {
      userId,
      tmdbId,
      mediaType,
      inWatchlist: finalUpdates.inWatchlist ?? false,
      progressStatus: finalUpdates.progressStatus,
      progress: finalUpdates.progress ?? 0,
      reaction: finalUpdates.reaction,
      updatedAt: now,
      ...metadataPatch,
    });
  }
}
