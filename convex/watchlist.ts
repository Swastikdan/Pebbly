import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { v } from "convex/values";

type WatchlistContext = QueryCtx | MutationCtx;
type WatchlistUser = Doc<"users">;
type WatchItem = Doc<"watch_items">;
type EpisodeProgress = Doc<"episode_progress">;
type MediaIdentity = {
  tmdbId: number;
  mediaType: string;
};
type WatchItemMetadata = {
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

function normalizeProgressStatus(status?: string): string | undefined {
  if (!status) return undefined;
  return VALID_PROGRESS_STATUSES.has(status) ? status : undefined;
}

async function getCurrentUser(ctx: WatchlistContext) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
    .first();
}

async function requireCurrentUser(ctx: WatchlistContext): Promise<WatchlistUser> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

async function getWatchItem(
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

async function getEpisodeProgressEntry(
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

async function getEpisodeProgressForShow(
  ctx: WatchlistContext,
  userId: WatchlistUser["_id"],
  tmdbId: number,
) {
  return ctx.db
    .query("episode_progress")
    .withIndex("by_user_media", (q) => q.eq("userId", userId).eq("tmdbId", tmdbId))
    .collect();
}

function buildMetadataPatch(
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

async function syncEpisodeProgressRecord(
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

export const updateProgress = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    progress: v.optional(v.number()),
    isWatched: v.optional(v.boolean()),
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

    const nextProgressStatus = inferredProgressStatus ?? currentProgressStatus;

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
      .collect();
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

    return items.map((item) => ({ tmdbId: item.tmdbId, mediaType: item.mediaType }));
  },
});

export const getMediaState = query({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
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
    mediaType: v.string(),
    inWatchlist: v.boolean(),
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
    const metadataPatch = buildMetadataPatch(args, existing ?? undefined);

    if (existing) {
      const normalizedExisting = normalizeProgressStatus(existing.progressStatus);
      await ctx.db.patch(existing._id, {
        inWatchlist: args.inWatchlist,
        updatedAt: now,
        progressStatus:
          normalizedExisting ??
          (args.inWatchlist ? "watch-later" : undefined),
        reaction: existing.reaction,
        ...metadataPatch,
      });

      return;
    }

    if (!args.inWatchlist) return;

    await ctx.db.insert("watch_items", {
      userId: user._id,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      inWatchlist: true,
      progressStatus: "watch-later",
      progress: 0,
      updatedAt: now,
      ...buildMetadataPatch(args),
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
    const user = await requireCurrentUser(ctx);
    const existing = await getWatchItem(ctx, user._id, args);

    const now = Date.now();

    const normalized = normalizeProgressStatus(args.progressStatus) ?? args.progressStatus;

    let nextProgress = args.progress;
    if (nextProgress === undefined) {
      if (normalized === "watch-later") nextProgress = 0;
      else if (normalized === "done") nextProgress = 100;
      else nextProgress = existing?.progress;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        progressStatus: normalized,
        progress: nextProgress,
        updatedAt: now,
        ...buildMetadataPatch(args, existing),
      });
      return;
    }

    await ctx.db.insert("watch_items", {
      userId: user._id,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      inWatchlist: false,
      progressStatus: normalized,
      progress: nextProgress,
      updatedAt: now,
      ...buildMetadataPatch(args),
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
    const user = await requireCurrentUser(ctx);
    const existing = await getWatchItem(ctx, user._id, args);

    const now = Date.now();
    const metadataPatch = buildMetadataPatch(args, existing ?? undefined);

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
        ...metadataPatch,
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
      ...buildMetadataPatch(args),
    };
    if (!args.clearReaction && args.reaction !== undefined) {
      doc.reaction = args.reaction;
    }

    await ctx.db.insert("watch_items", doc);
  },
});

export const markShowEpisodesAndStatus = mutation({
  args: {
    tmdbId: v.number(),
    mediaType: v.string(),
    seasons: v.array(
      v.object({
        season: v.number(),
        episodes: v.array(v.number()),
      }),
    ),
    isWatched: v.boolean(),
    clearAllEpisodes: v.optional(v.boolean()),
    progressStatus: v.optional(v.string()),
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
          inWatchlist: false,
          progressStatus: args.progressStatus,
          progress: args.progress ?? 0,
          updatedAt: now,
          ...buildMetadataPatch(args),
        });
      }
    }

    const allExisting = await getEpisodeProgressForShow(ctx, user._id, args.tmdbId);

    const existingMap = new Map<string, EpisodeProgress>();
    for (const ep of allExisting) {
      existingMap.set(`${ep.season}:${ep.episode}`, ep);
    }

    if (args.clearAllEpisodes || (!args.isWatched && args.seasons.length > 0)) {
      for (const ep of allExisting) {
        if (ep.isWatched) {
          await ctx.db.patch(ep._id, {
            isWatched: false,
            updatedAt: now,
          });
        }
      }
    } else {
      for (const seasonData of args.seasons) {
        for (const epNum of seasonData.episodes) {
          const key = `${seasonData.season}:${epNum}`;
          const existing = existingMap.get(key);

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
            season: seasonData.season,
            episode: epNum,
            isWatched: args.isWatched,
            updatedAt: now,
          });
        }
      }
    }
  },
});

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

    const allExisting = await getEpisodeProgressForShow(ctx, user._id, args.tmdbId);

    const existingMap = new Map<string, EpisodeProgress>();
    for (const ep of allExisting) {
      if (ep.season === args.season) {
        existingMap.set(`${ep.season}:${ep.episode}`, ep);
      }
    }

    for (const epNum of args.episodes) {
      const key = `${args.season}:${epNum}`;
      const existing = existingMap.get(key);

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
    const user = await requireCurrentUser(ctx);
    await syncEpisodeProgressRecord(ctx, user._id, args, Date.now());
  },
});

export const getCustomLists = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const lists = await ctx.db
      .query("lists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const listsWithPreviews = await Promise.all(
      lists.map(async (list) => {
        const items = await ctx.db
          .query("list_items")
          .withIndex("by_list", (q) => q.eq("listId", list._id))
          .collect();

        const previews = items
          .map((item) => item.backdrop ?? item.image)
          .filter((img): img is string => !!img)
          .slice(0, 4);

        return {
          ...list,
          previews,
          itemCount: items.length,
        };
      })
    );

    return listsWithPreviews;
  },
});

export const createCustomList = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("lists")
      .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", args.name))
      .first();
    if (existing) throw new Error("A list with this name already exists");

    const lists = await ctx.db
      .query("lists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const maxSort = lists.reduce((max, l) => Math.max(max, l.sortOrder), 0);

    const now = Date.now();
    return ctx.db.insert("lists", {
      userId: user._id,
      name: args.name,
      color: args.color,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCustomList = mutation({
  args: {
    listId: v.id("lists"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const list = await ctx.db.get(args.listId);
    if (!list || list.userId !== user._id) throw new Error("List not found");

    if (args.name !== undefined && args.name !== list.name) {
      const nameToCheck = args.name;
      const dup = await ctx.db
        .query("lists")
        .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", nameToCheck))
        .first();
      if (dup) throw new Error("A list with this name already exists");
    }

    await ctx.db.patch(args.listId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.color !== undefined ? { color: args.color } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const deleteCustomList = mutation({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const list = await ctx.db.get(args.listId);
    if (!list || list.userId !== user._id) throw new Error("List not found");

    const items = await ctx.db
      .query("list_items")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.listId);
  },
});

export const getListItems = query({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const items = await ctx.db
      .query("list_items")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();

    const enriched = await Promise.all(
      items.map(async (item) => {
        const watchItem = await ctx.db
          .query("watch_items")
          .withIndex("by_user_media", (q) =>
            q.eq("userId", user._id).eq("tmdbId", item.tmdbId).eq("mediaType", item.mediaType),
          )
          .first();

        return {
          ...item,
          title: item.title ?? watchItem?.title,
          image: item.image ?? watchItem?.image,
          rating: item.rating ?? watchItem?.rating,
          release_date: item.release_date ?? watchItem?.release_date,
          overview: item.overview ?? watchItem?.overview,
          progressStatus: watchItem?.progressStatus,
          reaction: watchItem?.reaction,
        };
      }),
    );

    return enriched;
  },
});

export const getItemLists = query({
  args: { tmdbId: v.number(), mediaType: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const items = await ctx.db
      .query("list_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .collect();

    return items.map((i) => i.listId);
  },
});

export const toggleListItem = mutation({
  args: {
    listId: v.id("lists"),
    tmdbId: v.number(),
    mediaType: v.string(),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    backdrop: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const items = await ctx.db
      .query("list_items")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
      )
      .collect();

    const existing = items.find((i) => i.listId === args.listId);
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    await ctx.db.insert("list_items", {
      userId: user._id,
      listId: args.listId,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      addedAt: Date.now(),
      title: args.title,
      image: args.image,
      backdrop: args.backdrop,
      rating: args.rating,
      release_date: args.release_date,
      overview: args.overview,
    });
    return true;
  },
});

export const createCustomListAndAddItem = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    tmdbId: v.number(),
    mediaType: v.string(),
    title: v.optional(v.string()),
    image: v.optional(v.string()),
    backdrop: v.optional(v.string()),
    rating: v.optional(v.number()),
    release_date: v.optional(v.string()),
    overview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("lists")
      .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", args.name))
      .first();
    if (existing) throw new Error("A list with this name already exists");

    const lists = await ctx.db
      .query("lists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const maxSort = lists.reduce((max, l) => Math.max(max, l.sortOrder), 0);

    const now = Date.now();
    const listId = await ctx.db.insert("lists", {
      userId: user._id,
      name: args.name,
      color: args.color,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("list_items", {
      userId: user._id,
      listId,
      tmdbId: args.tmdbId,
      mediaType: args.mediaType,
      addedAt: now,
      title: args.title,
      image: args.image,
      backdrop: args.backdrop,
      rating: args.rating,
      release_date: args.release_date,
      overview: args.overview,
    });

    return listId;
  },
});
