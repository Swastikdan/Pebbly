import { query, mutation } from "./_generated/server";

import { v } from "convex/values";

// getProgress removed - compute locally over getWatchlist items

// Update watch progress (e.g. from player)
export const updateProgress = mutation({
  args: {
    tmdbId: v.number(),

    mediaType: v.string(),

    progress: v.optional(v.number()), // Percentage

    status: v.optional(v.string()), // "watching", "completed"

    isWatched: v.optional(v.boolean()), // Explicitly mark as watched
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    const now = Date.now();

    const nextProgress =
      args.isWatched === true ? 100 : (args.progress ?? existing?.progress ?? 0);

    const nextStatus =
      args.isWatched === true
        ? "completed"
        : (args.status ?? existing?.status ?? "watching");

    if (existing) {
      await ctx.db.patch(existing._id, {
        progress: nextProgress,
        status: nextStatus,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("watch_items", {
        userId: user._id,
        tmdbId: args.tmdbId,
        mediaType: args.mediaType,
        progress: nextProgress,
        status: nextStatus,
        updatedAt: now,
      });
    }
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

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

    // Avoid storing explicit "false" rows.
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

// syncShowProgress removed - compute locally and use upsertWatchlistItem
// getEpisodeWatched removed - compute locally
// getSeasonWatched removed - compute locally

export const getAllWatchedEpisodes = query({
  args: {
    tmdbId: v.number(),
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) return [];

    const items = await ctx.db
      .query("episode_progress")
      .withIndex("by_user_media", (q) => q.eq("userId", user._id).eq("tmdbId", args.tmdbId))
      .collect();

    return items;
  },
});

// getContinueWatching removed - compute locally

// Get full watchlist
export const getWatchlist = query({
  args: {},

  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) return [];

    const items = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return items;
  },
});

// Upsert generic watchlist item (Plan to Watch, etc.)
export const upsertWatchlistItem = mutation({
  args: {
    tmdbId: v.number(),

    mediaType: v.string(),

    status: v.string(),

    progress: v.optional(v.number()), // added optional progress

    title: v.optional(v.string()),

    image: v.optional(v.string()),

    rating: v.optional(v.number()),

    release_date: v.optional(v.string()),

    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    const now = Date.now();

    if (args.status === "plan-to-watch" && args.mediaType === "tv") {
      const episodes = await ctx.db
        .query("episode_progress")
        .withIndex("by_user_media", (q) => q.eq("userId", user._id).eq("tmdbId", args.tmdbId))
        .collect();

      for (const ep of episodes) {
        await ctx.db.delete(ep._id);
      }
    }

    let progress = args.progress;

    if (progress === undefined) {
      if (args.status === "plan-to-watch") progress = 0;
      else if (args.status === "completed") progress = 100;
      else progress = existing?.progress ?? 0;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        updatedAt: now,
        progress,

        // Update metadata if provided
        title: args.title ?? existing.title,
        image: args.image ?? existing.image,
        rating: args.rating ?? existing.rating,
        release_date: args.release_date ?? existing.release_date,
        overview: args.overview ?? existing.overview,
      });
    } else {
      await ctx.db.insert("watch_items", {
        userId: user._id,
        tmdbId: args.tmdbId,
        mediaType: args.mediaType,
        status: args.status,
        progress,
        updatedAt: now,
        title: args.title,
        image: args.image,
        rating: args.rating,
        release_date: args.release_date,
        overview: args.overview,
      });
    }
  },
});

export const removeWatchlistItem = mutation({
  args: {
    tmdbId: v.number(),

    mediaType: v.string(),
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

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
      } else {
        // Avoid storing explicit "false" rows.
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
    }
  },
});
