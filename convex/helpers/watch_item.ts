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

  const subject = identity.subject;
  const tokenIdentifier = identity.tokenIdentifier;

  // 1. Fast path: check exact tokenIdentifier or subject index
  if (tokenIdentifier) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .first();
    if (user) return user;
  }

  if (subject && subject !== tokenIdentifier) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", subject))
      .first();
    if (user) return user;
  }

  if (subject) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", `clerk|${subject}`))
      .first();
    if (user) return user;
  }

  // 2. Fallback search across all users to handle multi-format matching
  const allUsers = await ctx.db.query("users").take(500);
  const userMatches = allUsers.filter(
    (u) =>
      u.tokenIdentifier === tokenIdentifier ||
      u.tokenIdentifier === subject ||
      u.tokenIdentifier === `clerk|${subject}` ||
      (subject && u.tokenIdentifier.endsWith(`|${subject}`)) ||
      (subject && u.tokenIdentifier.endsWith(subject)),
  );

  if (userMatches.length === 0) return null;
  if (userMatches.length === 1) return userMatches[0];

  // If multiple user docs exist, prefer the one that already has watch items
  for (const candidate of userMatches) {
    const hasItems = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", candidate._id))
      .first();
    if (hasItems) return candidate;
  }

  return (
    userMatches.find((u) => u.tokenIdentifier === tokenIdentifier) ??
    userMatches[0]
  );
}

export async function requireCurrentUser(ctx: WatchlistContext): Promise<WatchlistUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }

  let user = await getCurrentUser(ctx);
  if (!user) {
    if ("insert" in ctx.db || typeof (ctx.db as any).insert === "function") {
      const meta =
        (identity.public_meta as Record<string, unknown> | undefined) ??
        (identity.publicMetadata as Record<string, unknown> | undefined);
      const isAdmin = meta && typeof meta === "object" && "isAdmin" in meta ? meta.isAdmin === true : false;

      const primaryToken = identity.tokenIdentifier ?? identity.subject;
      const userId = await (ctx as MutationCtx).db.insert("users", {
        tokenIdentifier: primaryToken,
        name: identity.name ?? identity.nickname ?? "Anonymous",
        email: identity.email,
        image: identity.pictureUrl,
        isAdmin,
      });
      user = (await ctx.db.get(userId))!;
    } else {
      throw new Error("Unauthorized");
    }
  }

  // Auto-consolidate orphaned watch items from duplicate user documents if any exist
  if ("patch" in ctx.db || typeof (ctx.db as any).patch === "function") {
    const subject = identity.subject;
    const tokenIdentifier = identity.tokenIdentifier;
    const allUsers = await ctx.db.query("users").take(500);
    const userMatches = allUsers.filter(
      (u) =>
        u.tokenIdentifier === tokenIdentifier ||
        u.tokenIdentifier === subject ||
        u.tokenIdentifier === `clerk|${subject}` ||
        (subject && u.tokenIdentifier.endsWith(`|${subject}`)) ||
        (subject && u.tokenIdentifier.endsWith(subject)),
    );

    if (userMatches.length > 1) {
      for (const dup of userMatches) {
        if (dup._id === user._id) continue;
        const dupItems = await ctx.db
          .query("watch_items")
          .withIndex("by_user", (q) => q.eq("userId", dup._id))
          .take(500);
        for (const item of dupItems) {
          const existingInMain = await ctx.db
            .query("watch_items")
            .withIndex("by_user_media", (q) =>
              q
                .eq("userId", user._id)
                .eq("tmdbId", item.tmdbId)
                .eq("mediaType", item.mediaType),
            )
            .first();
          if (!existingInMain) {
            await (ctx as MutationCtx).db.patch(item._id, { userId: user._id });
          }
        }
      }
    }
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
