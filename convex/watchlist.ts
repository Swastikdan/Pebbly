import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  requireCurrentUser,
  getCurrentUser,
  getWatchItem,
  upsertWatchItem,
  buildMetadataPatch,
  normalizeProgressStatus,
  type WatchlistUser,
  type MediaType,
  MEDIA_TYPE_VALIDATOR,
  PROGRESS_STATUS_VALIDATOR,
  REACTION_VALIDATOR,
} from "./helpers/watch-item";

// Re-export everything from the new modules to not break existing clients
export * from "./episode-progress";
export * from "./custom-lists";
export * from "./import-export";

export async function createWatchlistSnapshot(
  ctx: MutationCtx,
  userId: WatchlistUser["_id"],
) {
  const items = await ctx.db
    .query("watch_items")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const watchlistItems = items
    .filter((item) => item.inWatchlist)
    .map((item) => ({ tmdbId: item.tmdbId, mediaType: item.mediaType }))
    .sort((a, b) => a.tmdbId - b.tmdbId || a.mediaType.localeCompare(b.mediaType));
  const latest = await ctx.db
    .query("watchlist_snapshots")
    .withIndex("by_user_and_createdAt", (q) => q.eq("userId", userId))
    .order("desc")
    .first();

  if (
    latest &&
    latest.items &&
    latest.items.length === watchlistItems.length &&
    latest.items.every(
      (item, index) =>
        item.tmdbId === watchlistItems[index].tmdbId &&
        item.mediaType === watchlistItems[index].mediaType,
    )
  ) {
    return;
  }

  await ctx.db.insert("watchlist_snapshots", {
    userId,
    items: watchlistItems.slice(0, 8000),
    createdAt: Date.now(),
  });
}

export const updateProgress = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
    progress: v.optional(v.number()),
    isWatched: v.optional(v.boolean()),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await getWatchItem(ctx, user._id, args);

    const now = Date.now();
    const nextProgress =
      args.isWatched === true ? 100 : (args.progress ?? existing?.progress ?? 0);

    const currentProgressStatus =
      normalizeProgressStatus(existing?.progressStatus);

    const inferredProgressStatus =
      args.isWatched === true
        ? "done"
        : (nextProgress >= 95
            ? "done"
            : nextProgress > 0
              ? "watching"
              : undefined);

    const nextProgressStatus = currentProgressStatus ?? inferredProgressStatus;

    if (existing) {
      await ctx.db.patch(existing._id, {
        progress: nextProgress,
        progressStatus: nextProgressStatus,
        inWatchlist: true,
        updatedAt: now,
        ...buildMetadataPatch(args, existing),
      });
      return;
    }

    await ctx.db.insert("watch_items", {
      userId: user._id,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType as MediaType,
      inWatchlist: true,
      progress: nextProgress,
      progressStatus: nextProgressStatus,
      updatedAt: now,
      ...buildMetadataPatch(args),
    });
  },
});

export const removeFromContinueWatching = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await getWatchItem(ctx, user._id, args);
    if (!existing) return;

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      progressStatus: existing.inWatchlist ? "watch-later" : undefined,
      progress: 0,
      updatedAt: now,
    });
  },
});

export const getWatchlist = query({
  args: {},

  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const items = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return items;
  },
});

export const getTrackedTmdbIds = query({
  args: {},

  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const items = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return items.map((item) => item.tmdbId);
  },
});

export const getMediaState = query({
  args: {
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return getWatchItem(ctx, user._id, args);
  },
});

export const setWatchlistMembership = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
    inWatchlist: v.boolean(),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await upsertWatchItem(ctx, user._id, args.tmdbId, args.mediaType as MediaType, (existing) => {
      if (!existing && !args.inWatchlist) return null;

      const normalizedExisting = existing ? normalizeProgressStatus(existing.progressStatus) : undefined;
      const progressStatus = existing
        ? (normalizedExisting ?? (args.inWatchlist ? "watch-later" : undefined))
        : "watch-later";

      return {
        inWatchlist: args.inWatchlist,
        progressStatus,
        ...(existing ? {} : { progress: 0 }),
        title: args.title,
        image: args.image,
        rating: args.rating,
        release_date: args.release_date,
        overview: args.overview,
      };
    });
  },
});

export const setProgressStatus = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
    progressStatus: PROGRESS_STATUS_VALIDATOR,
    progress: v.optional(v.number()),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await upsertWatchItem(ctx, user._id, args.tmdbId, args.mediaType as MediaType, (existing) => {
      const normalized = normalizeProgressStatus(args.progressStatus) ?? args.progressStatus;
      let nextProgress = args.progress;
      if (nextProgress === undefined) {
        if (normalized === "watch-later") nextProgress = 0;
        else if (normalized === "done") nextProgress = 100;
        else nextProgress = existing?.progress;
      }

      return {
        inWatchlist: true,
        progressStatus: normalized,
        progress: nextProgress,
        title: args.title,
        image: args.image,
        rating: args.rating,
        release_date: args.release_date,
        overview: args.overview,
      };
    });
  },
});

export const setReaction = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
    reaction: v.optional(REACTION_VALIDATOR),
    clearReaction: v.optional(v.boolean()),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await upsertWatchItem(ctx, user._id, args.tmdbId, args.mediaType as MediaType, (existing) => {
      const reaction = args.clearReaction ? null : (args.reaction !== undefined ? args.reaction : existing?.reaction);
      
      return {
        reaction,
        title: args.title,
        image: args.image,
        rating: args.rating,
        release_date: args.release_date,
        overview: args.overview,
      };
    });
  },
});

export const createDailySnapshots = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("users")
      .paginate({ cursor: args.cursor ?? null, numItems: 50 });
    for (const user of batch.page) {
      try {
        await createWatchlistSnapshot(ctx, user._id);
      } catch (error) {
        console.error(`Failed to create snapshot for user ${user._id}:`, error);
      }
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.watchlist.createDailySnapshots, {
        cursor: batch.continueCursor,
      });
    }
  },
});
