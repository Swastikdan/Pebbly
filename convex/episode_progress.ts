import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  getCurrentUser,
  type WatchlistContext,
  type WatchlistUser,
  getWatchItem,
  buildMetadataPatch,
  MEDIA_TYPE_VALIDATOR,
  PROGRESS_STATUS_VALIDATOR,
} from "./helpers/watch_item";

export async function getEpisodeProgressEntry(
  ctx: WatchlistContext,
  userId: WatchlistUser["_id"],
  tmdbId: number,
  season: number,
  episode: number,
) {
  return ctx.db
    .query("episode_progress")
    .withIndex("by_user_episode", (q) =>
      q
        .eq("userId", userId)
        .eq("tmdbId", tmdbId)
        .eq("season", season)
        .eq("episode", episode),
    )
    .first();
}

export async function getEpisodeProgressForShow(
  ctx: WatchlistContext,
  userId: WatchlistUser["_id"],
  tmdbId: number,
) {
  return ctx.db
    .query("episode_progress")
    .withIndex("by_user_media", (q) => q.eq("userId", userId).eq("tmdbId", tmdbId))
    .take(500);
}

export async function syncEpisodeProgressRecord(
  ctx: MutationCtx,
  userId: WatchlistUser["_id"],
  args: {
    tmdbId: number;
    season: number;
    episode: number;
    isWatched: boolean;
  },
  now: number,
) {
  const existing = await getEpisodeProgressEntry(
    ctx,
    userId,
    args.tmdbId,
    args.season,
    args.episode,
  );

  if (existing) {
    if (existing.isWatched !== args.isWatched) {
      await ctx.db.patch(existing._id, {
        isWatched: args.isWatched,
        updatedAt: now,
      });
    }
    return;
  }

  if (!args.isWatched) {
    return;
  }

  await ctx.db.insert("episode_progress", {
    userId,
    tmdbId: args.tmdbId,
    season: args.season,
    episode: args.episode,
    isWatched: args.isWatched,
    updatedAt: now,
  });
}

export const markEpisodeWatched = mutation({
  args: {
    tmdbId: v.number(),
    season: v.number(),
    episode: v.number(),
    isWatched: v.boolean(),
  },

  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await syncEpisodeProgressRecord(ctx, user._id, args, Date.now());
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
      .take(500);
  },
});

export const markShowEpisodesWatched = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: MEDIA_TYPE_VALIDATOR,
    seasons: v.array(
      v.object({
        season: v.number(),
        episodes: v.array(v.number()),
      }),
    ),
    isWatched: v.boolean(),
    clearAllEpisodes: v.optional(v.boolean()),
    progressStatus: v.optional(PROGRESS_STATUS_VALIDATOR),
    progress: v.optional(v.number()),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const now = Date.now();

    if (args.progressStatus !== undefined) {
      const existing = await getWatchItem(ctx, user._id, args);

      if (existing) {
        await ctx.db.patch(existing._id, {
          inWatchlist: true,
          progressStatus: args.progressStatus,
          progress: args.progress ?? existing.progress,
          updatedAt: now,
          ...buildMetadataPatch(args, existing),
        });
      } else {
        await ctx.db.insert("watch_items", {
          userId: user._id,
          tmdbId: args.tmdbId,
          mediaType: args.mediaType,
          inWatchlist: true,
          progressStatus: args.progressStatus,
          progress: args.progress ?? 0,
          updatedAt: now,
          ...buildMetadataPatch(args),
        });
      }
    }

    const allExisting = await getEpisodeProgressForShow(ctx, user._id, args.tmdbId);

    if (args.clearAllEpisodes || (!args.isWatched && args.seasons.length > 0)) {
      for (const ep of allExisting) {
        if (ep.isWatched) {
          await syncEpisodeProgressRecord(
            ctx,
            user._id,
            { tmdbId: args.tmdbId, season: ep.season, episode: ep.episode, isWatched: false },
            now
          );
        }
      }
    } else {
      for (const seasonData of args.seasons) {
        const uniqueEpisodes = Array.from(new Set(seasonData.episodes));
        for (const epNum of uniqueEpisodes) {
          await syncEpisodeProgressRecord(
            ctx,
            user._id,
            { tmdbId: args.tmdbId, season: seasonData.season, episode: epNum, isWatched: args.isWatched },
            now
          );
        }
      }
    }
  },
});

// Alias for backwards compatibility
export const markShowEpisodesAndStatus = markShowEpisodesWatched;

export const markSeasonEpisodesWatched = mutation({
  args: {
    tmdbId: v.number(),
    season: v.number(),
    episodes: v.array(v.number()),
    isWatched: v.boolean(),
  },

  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const now = Date.now();

    const uniqueEpisodes = Array.from(new Set(args.episodes));
    for (const epNum of uniqueEpisodes) {
      await syncEpisodeProgressRecord(
        ctx,
        user._id,
        { tmdbId: args.tmdbId, season: args.season, episode: epNum, isWatched: args.isWatched },
        now
      );
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
      .take(2000);
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
    const user = await requireCurrentUser(ctx);
    await syncEpisodeProgressRecord(ctx, user._id, args, Date.now());
  },
});
