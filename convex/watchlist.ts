import { mutation, query } from "./_generated/server";

import { v } from "convex/values";

function mapLegacyStatusFields(
  status?: string,
  progress?: number,
): { progressStatus?: string; reaction?: string } {
  if (!status) return {};

  if (status === "plan-to-watch") return { progressStatus: "want-to-watch" };
  if (status === "watching") return { progressStatus: "watching" };
  if (status === "completed") return { progressStatus: "finished" };
  if (status === "liked") {
    return { progressStatus: "finished", reaction: "liked" };
  }

  if (status === "dropped") {
    const derivedProgressStatus =
      progress === undefined || progress <= 0
        ? "want-to-watch"
        : progress >= 100
          ? "finished"
          : "watching";

    return {
      progressStatus: derivedProgressStatus,
      reaction: "not-for-me",
    };
  }

  return {};
}

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.subject))
    .first();
}

// Update watch progress (e.g. from player)
export const updateProgress = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    progress: v.optional(v.number()),
    status: v.optional(v.string()), // legacy compatibility
    isWatched: v.optional(v.boolean()),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    const now = Date.now();
    const nextProgress =
      args.isWatched === true ? 100 : (args.progress ?? existing?.progress ?? 0);

    const existingDerived = mapLegacyStatusFields(existing?.status, existing?.progress)
      .progressStatus;

    const currentProgressStatus = existing?.progressStatus ?? existingDerived;

    const argDerived = mapLegacyStatusFields(args.status, nextProgress).progressStatus;

    const inferredProgressStatus =
      args.isWatched === true
        ? "finished"
        : argDerived ??
          (nextProgress >= 95
            ? "finished"
            : nextProgress > 0
              ? "watching"
              : undefined);

    const nextProgressStatus = currentProgressStatus ?? inferredProgressStatus;

    if (existing) {
      await ctx.db.patch(existing._id, {
        progress: nextProgress,
        progressStatus: nextProgressStatus,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("watch_items", {
      userId: user._id,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      inWatchlist: false,
      progress: nextProgress,
      progressStatus: nextProgressStatus,
      updatedAt: now,
    });
  },
});

// Mark episode as watched
export const markEpisodeWatched = mutation({
  args: {
    tmdbId: v.number(),
    season: v.number(),
    episode: v.number(),
    isWatched: v.boolean(),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("episode_progress")
      .withIndex("by_user_episode", (q) =>
        q
          .eq("userId", user._id)
          .eq("tmdbId", args.tmdbId)
          .eq("season", args.season)
          .eq("episode", args.episode),
      )
      .first();

    const now = Date.now();

    if (existing) {
      if (existing.isWatched !== args.isWatched) {
        await ctx.db.patch(existing._id, {
          isWatched: args.isWatched,
          updatedAt: now,
        });
      }
      return;
    }

    if (!args.isWatched) return;

    await ctx.db.insert("episode_progress", {
      userId: user._id,
      tmdbId: args.tmdbId,
      season: args.season,
      episode: args.episode,
      isWatched: args.isWatched,
      updatedAt: now,
    });
  },
});

export const getAllWatchedEpisodes = query({
  args: {
    tmdbId: v.number(),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return ctx.db
      .query("episode_progress")
      .withIndex("by_user_media", (q) => q.eq("userId", user._id).eq("tmdbId", args.tmdbId))
      .collect();
  },
});

// Membership-scoped watchlist query
export const getWatchlist = query({
  args: {},

  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const items = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return items.filter((item) => item.inWatchlist ?? true);
  },
});

// Full tracking state for one media item (independent of watchlist membership)
export const getMediaState = query({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();
  },
});

export const setWatchlistMembership = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    inWatchlist: v.boolean(),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    const now = Date.now();

    if (existing) {
      const existingDerived = mapLegacyStatusFields(existing.status, existing.progress);

      await ctx.db.patch(existing._id, {
        inWatchlist: args.inWatchlist,
        updatedAt: now,
        progressStatus:
          existing.progressStatus ??
          existingDerived.progressStatus ??
          (args.inWatchlist ? "want-to-watch" : undefined),
        reaction: existing.reaction ?? existingDerived.reaction,
        title: args.title ?? existing.title,
        image: args.image ?? existing.image,
        rating: args.rating ?? existing.rating,
        release_date: args.release_date ?? existing.release_date,
        overview: args.overview ?? existing.overview,
      });

      return;
    }

    if (!args.inWatchlist) return;

    await ctx.db.insert("watch_items", {
      userId: user._id,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      inWatchlist: true,
      progressStatus: "want-to-watch",
      progress: 0,
      updatedAt: now,
      title: args.title,
      image: args.image,
      rating: args.rating,
      release_date: args.release_date,
      overview: args.overview,
    });
  },
});

export const setProgressStatus = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    progressStatus: v.string(),
    progress: v.optional(v.number()),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    const now = Date.now();

    let nextProgress = args.progress;
    if (nextProgress === undefined) {
      if (args.progressStatus === "want-to-watch") nextProgress = 0;
      else if (args.progressStatus === "finished") nextProgress = 100;
      else nextProgress = existing?.progress;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        progressStatus: args.progressStatus,
        progress: nextProgress,
        updatedAt: now,
        title: args.title ?? existing.title,
        image: args.image ?? existing.image,
        rating: args.rating ?? existing.rating,
        release_date: args.release_date ?? existing.release_date,
        overview: args.overview ?? existing.overview,
      });
      return;
    }

    await ctx.db.insert("watch_items", {
      userId: user._id,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      inWatchlist: false,
      progressStatus: args.progressStatus,
      progress: nextProgress,
      updatedAt: now,
      title: args.title,
      image: args.image,
      rating: args.rating,
      release_date: args.release_date,
      overview: args.overview,
    });
  },
});

export const setReaction = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    reaction: v.optional(v.string()),
    clearReaction: v.optional(v.boolean()),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    const now = Date.now();

    if (existing) {
      const patch: {
        reaction?: string | undefined;
        updatedAt: number;
        title?: string;
        image?: string;
        rating?: number;
        release_date?: string;
        overview?: string;
      } = {
        updatedAt: now,
        title: args.title ?? existing.title,
        image: args.image ?? existing.image,
        rating: args.rating ?? existing.rating,
        release_date: args.release_date ?? existing.release_date,
        overview: args.overview ?? existing.overview,
      };

      if (args.clearReaction) patch.reaction = undefined;
      else if (args.reaction !== undefined) patch.reaction = args.reaction;

      await ctx.db.patch(existing._id, patch);
      return;
    }

    const doc: {
      userId: typeof user._id;
      tmdbId: number;
      mediaType: string;
      inWatchlist: boolean;
      reaction?: string;
      updatedAt: number;
      title?: string;
      image?: string;
      rating?: number;
      release_date?: string;
      overview?: string;
    } = {
      userId: user._id,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      inWatchlist: false,
      updatedAt: now,
      title: args.title,
      image: args.image,
      rating: args.rating,
      release_date: args.release_date,
      overview: args.overview,
    };
    if (!args.clearReaction && args.reaction !== undefined) {
      doc.reaction = args.reaction;
    }

    await ctx.db.insert("watch_items", doc);
  },
});

// Legacy compatibility mutation during rollout.
export const upsertWatchlistItem = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    status: v.string(),
    progress: v.optional(v.number()),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    const now = Date.now();
    const mapped = mapLegacyStatusFields(args.status, args.progress ?? existing?.progress);

    let progress = args.progress;
    if (progress === undefined) {
      if (mapped.progressStatus === "want-to-watch") progress = 0;
      else if (mapped.progressStatus === "finished") progress = 100;
      else progress = existing?.progress ?? 0;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        inWatchlist: true,
        status: args.status,
        progressStatus:
          mapped.progressStatus ?? existing.progressStatus ?? "want-to-watch",
        reaction: mapped.reaction ?? existing.reaction,
        progress,
        updatedAt: now,
        title: args.title ?? existing.title,
        image: args.image ?? existing.image,
        rating: args.rating ?? existing.rating,
        release_date: args.release_date ?? existing.release_date,
        overview: args.overview ?? existing.overview,
      });
      return;
    }

    await ctx.db.insert("watch_items", {
      userId: user._id,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      inWatchlist: true,
      status: args.status,
      progressStatus: mapped.progressStatus ?? "want-to-watch",
      reaction: mapped.reaction,
      progress,
      updatedAt: now,
      title: args.title,
      image: args.image,
      rating: args.rating,
      release_date: args.release_date,
      overview: args.overview,
    });
  },
});

// Legacy compatibility mutation. Membership is now decoupled and preserved status/progress remain.
export const removeWatchlistItem = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    if (!existing) return;

    await ctx.db.patch(existing._id, {
      inWatchlist: false,
      updatedAt: Date.now(),
    });
  },
});

// One-time migration helper to backfill split status fields for current user.
export const backfillWatchItems = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const items = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();

    for (const item of items) {
      const mapped = mapLegacyStatusFields(item.status, item.progress);
      const patch: {
        inWatchlist?: boolean;
        progressStatus?: string;
        reaction?: string;
        updatedAt: number;
      } = {
        updatedAt: now,
      };

      if (item.inWatchlist === undefined) patch.inWatchlist = true;
      if (item.progressStatus === undefined && mapped.progressStatus) {
        patch.progressStatus = mapped.progressStatus;
      }
      if (item.reaction === undefined && mapped.reaction) {
        patch.reaction = mapped.reaction;
      }

      if (
        patch.inWatchlist !== undefined ||
        patch.progressStatus !== undefined ||
        patch.reaction !== undefined
      ) {
        await ctx.db.patch(item._id, patch);
      }
    }
  },
});

// Batch mark episodes watched (e.g. for a whole season)
export const markSeasonEpisodesWatched = mutation({
  args: {
    tmdbId: v.number(),
    season: v.number(),
    episodes: v.array(v.number()),
    isWatched: v.boolean(),
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const now = Date.now();

    for (const epNum of args.episodes) {
      const existing = await ctx.db
        .query("episode_progress")
        .withIndex("by_user_episode", (q) =>
          q
            .eq("userId", user._id)
            .eq("tmdbId", args.tmdbId)
            .eq("season", args.season)
            .eq("episode", epNum),
        )
        .first();

      if (existing) {
        if (existing.isWatched !== args.isWatched) {
          await ctx.db.patch(existing._id, {
            isWatched: args.isWatched,
            updatedAt: now,
          });
        }
        continue;
      }

      if (!args.isWatched) continue;

      await ctx.db.insert("episode_progress", {
        userId: user._id,
        tmdbId: args.tmdbId,
        season: args.season,
        episode: epNum,
        isWatched: args.isWatched,
        updatedAt: now,
      });
    }
  },
});

export const getAllEpisodeProgress = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return ctx.db
      .query("episode_progress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const syncEpisodeProgressItem = mutation({
  args: {
    tmdbId: v.number(),
    season: v.number(),
    episode: v.number(),
    isWatched: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("episode_progress")
      .withIndex("by_user_episode", (q) =>
        q
          .eq("userId", user._id)
          .eq("tmdbId", args.tmdbId)
          .eq("season", args.season)
          .eq("episode", args.episode),
      )
      .first();

    const now = Date.now();

    if (existing) {
      if (existing.isWatched !== args.isWatched) {
        await ctx.db.patch(existing._id, {
          isWatched: args.isWatched,
          updatedAt: now,
        });
      }
      return;
    }

    if (!args.isWatched) return;

    await ctx.db.insert("episode_progress", {
      userId: user._id,
      tmdbId: args.tmdbId,
      season: args.season,
      episode: args.episode,
      isWatched: args.isWatched,
      updatedAt: now,
    });
  },
});
