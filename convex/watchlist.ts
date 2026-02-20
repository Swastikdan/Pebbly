import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get watch progress for a specific item
export const getProgress = query({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(), // "movie" | "tv"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) return null;

    const item = await ctx.db
      .query("watch_items")
      .withIndex("by_user_media", (q) => 
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)
      )
      .first();

    return item;
  },
});

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
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        progress: args.progress ?? existing.progress,
        status: args.status ?? existing.status,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("watch_items", {
        userId: user._id,
        tmdbId: args.tmdbId,
        mediaType: args.mediaType,
        progress: args.progress ?? 0,
        status: args.status ?? "watching",
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

    // Existing logic for episode progress
    const existing = await ctx.db
      .query("episode_progress")
      .withIndex("by_user_episode", (q) =>
        q.eq("userId", user._id)
         .eq("tmdbId", args.tmdbId)
         .eq("season", args.season)
         .eq("episode", args.episode)
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
    } else {
      await ctx.db.insert("episode_progress", {
        userId: user._id,
        tmdbId: args.tmdbId,
        season: args.season,
        episode: args.episode,
        isWatched: args.isWatched,
        updatedAt: now,
      });
    }

  },
});

// NEW: Sync all episodes and update show progress based on watched count
export const syncShowProgress = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(), // "tv"
    totalEpisodes: v.number(), // Passed from client
    watchedEpisodesCount: v.number(), // Passed from client
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Determine status and progress based on counts
    let status = "watching";
    let progress = 0;

    if (args.watchedEpisodesCount === 0) {
        status = "plan-to-watch";
        progress = 0;
    } else if (args.watchedEpisodesCount >= args.totalEpisodes && args.totalEpisodes > 0) {
        status = "completed";
        progress = 100;
    } else {
        status = "watching";
        progress = Math.floor((args.watchedEpisodesCount / args.totalEpisodes) * 100);
    }

    const existing = await ctx.db
    .query("watch_items")
    .withIndex("by_user_media", (q) => 
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", "tv")
    )
    .first();
    
    const now = Date.now();
    
    if (existing) {
        // Only update if status or progress is different to avoid churn? 
        // Or just update always. safely.
        await ctx.db.patch(existing._id, {
            progress,
            status,
            updatedAt: now,
        });
    } else {
        await ctx.db.insert("watch_items", {
            userId: user._id,
            tmdbId: args.tmdbId,
            mediaType: "tv",
            progress,
            status,
            updatedAt: now,
        });
    }
  },
});

// Get watched status for a specific episode
export const getEpisodeWatched = query({
  args: {
    tmdbId: v.number(),
    season: v.number(),
    episode: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) return null;

    const item = await ctx.db
      .query("episode_progress")
      .withIndex("by_user_episode", (q) =>
        q.eq("userId", user._id)
         .eq("tmdbId", args.tmdbId)
         .eq("season", args.season)
         .eq("episode", args.episode)
      )
      .first();

    return item;
  },
});

// Get all watched episodes for a season
export const getSeasonWatched = query({
  args: {
    tmdbId: v.number(),
    season: v.number(),
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
      .withIndex("by_user_season", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("season", args.season)
      )
      .collect();
    return items;
  },
});

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

    // We need an index by_user_media on episode_progress?
    // In schema.ts: .index("by_user_media", ["userId", "tmdbId"]) was NOT added to episode_progress initially?
    // Let me check what I added to schema.ts.
    // I added: .index("by_user_episode", ...) and .index("by_user_season", ...).
    // I did NOT add "by_user_media" index for episode_progress.
    // So querying by userId+tmdbId will require a full scan of episodes for that user? No, I can iterate seasons?
    // Or I should add the index.
    
    // I will add the index.
    const items = await ctx.db
      .query("episode_progress")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId)
      )
      .collect();

    return items;
  },
});



export const getContinueWatching = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) return [];

    // Filter by status 'watching' or verify progress
    // Since we can't sort by lastUpdated easily without index, let's filter in memory for now or add index
    // We have index by_user_media, but not by_user with sort?
    // We have .index("by_user", ["userId"])
    
    const items = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // specific filtering for "Continue Watching"
    return items
      .filter((item) => item.progress !== undefined && item.progress > 0 && item.progress < 100)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});




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

    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Upsert generic watchlist item (Plan to Watch, etc.)
export const upsertWatchlistItem = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    status: v.string(),
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
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)
      )
      .first();

    const now = Date.now();

    if (args.status === "plan-to-watch" && args.mediaType === "tv") {
        const episodes = await ctx.db
          .query("episode_progress")
          .withIndex("by_user_media", (q) =>
            q.eq("userId", user._id).eq("tmdbId", args.tmdbId)
          )
          .collect();
        for (const ep of episodes) {
            await ctx.db.delete(ep._id);
        }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        updatedAt: now,
        progress: args.status === "plan-to-watch" ? 0 : (args.status === "completed" ? 100 : existing.progress),
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
        progress: args.status === "completed" ? 100 : 0,
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
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)
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
            q.eq("userId", user._id)
             .eq("tmdbId", args.tmdbId)
             .eq("season", args.season)
             .eq("episode", epNum)
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
