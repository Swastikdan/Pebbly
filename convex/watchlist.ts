import { mutation, query } from "./_generated/server";

import { v } from "convex/values";

/** Normalise any legacy or old-format progressStatus string to current values. */
function normalizeProgressStatus(status?: string): string | undefined {
  if (!status) return undefined;
  if (status === "want-to-watch" || status === "plan-to-watch") return "watch-later";
  if (status === "finished" || status === "completed") return "done";
  if (status === "caught-up") return "watching";
  if (status === "liked") return "done";
  // Already valid
  if (status === "watch-later" || status === "watching" || status === "done" || status === "dropped") return status;
  return undefined;
}

function mapLegacyStatusFields(
  status?: string,
  progress?: number,
): { progressStatus?: string; reaction?: string } {
  if (!status) return {};

  if (status === "plan-to-watch") return { progressStatus: "watch-later" };
  if (status === "want-to-watch") return { progressStatus: "watch-later" };
  if (status === "watching") return { progressStatus: "watching" };
  if (status === "completed" || status === "finished") return { progressStatus: "done" };
  if (status === "caught-up") return { progressStatus: "watching" };
  if (status === "liked") {
    return { progressStatus: "done", reaction: "liked" };
  }

  if (status === "dropped") {
    const derivedProgressStatus =
      progress === undefined || progress <= 0
        ? "watch-later"
        : progress >= 100
          ? "done"
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

    const currentProgressStatus = normalizeProgressStatus(existing?.progressStatus) ?? existingDerived;

    const argDerived = mapLegacyStatusFields(args.status, nextProgress).progressStatus;

    const inferredProgressStatus =
      args.isWatched === true
        ? "done"
        : argDerived ??
          (nextProgress >= 95
            ? "done"
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

      const normalizedExisting = normalizeProgressStatus(existing.progressStatus);
      await ctx.db.patch(existing._id, {
        inWatchlist: args.inWatchlist,
        updatedAt: now,
        progressStatus:
          normalizedExisting ??
          existingDerived.progressStatus ??
          (args.inWatchlist ? "watch-later" : undefined),
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
      progressStatus: "watch-later",
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
      progressStatus: normalized,
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
      if (mapped.progressStatus === "watch-later") progress = 0;
      else if (mapped.progressStatus === "done") progress = 100;
      else progress = existing?.progress ?? 0;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        inWatchlist: true,
        status: args.status,
        progressStatus:
          mapped.progressStatus ?? normalizeProgressStatus(existing.progressStatus) ?? "watch-later",
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
      progressStatus: mapped.progressStatus ?? "watch-later",
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

// Batch mark all episodes across all seasons and update progress status in one transaction.
// Replaces the N+1 pattern of calling setProgressStatus + markSeasonEpisodesWatched per season.
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
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const now = Date.now();

    // 1. Update watch_items (progressStatus + progress) if requested
    if (args.progressStatus !== undefined) {
      const existing = await ctx.db
        .query("watch_items")
        .withIndex("by_user_media", (q) =>
          q.eq("userId", user._id).eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          progressStatus: args.progressStatus,
          progress: args.progress ?? existing.progress,
          updatedAt: now,
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
          inWatchlist: false,
          progressStatus: args.progressStatus,
          progress: args.progress ?? 0,
          updatedAt: now,
          title: args.title,
          image: args.image,
          rating: args.rating,
          release_date: args.release_date,
          overview: args.overview,
        });
      }
    }

    // 2. Bulk-fetch ALL existing episode_progress records for this show in one query
    const allExisting = await ctx.db
      .query("episode_progress")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId),
      )
      .collect();

    // Build a lookup map: "season:episode" -> existing record
    const existingMap = new Map<string, (typeof allExisting)[0]>();
    for (const ep of allExisting) {
      existingMap.set(`${ep.season}:${ep.episode}`, ep);
    }

    // 3. Process episodes
    if (args.clearAllEpisodes || (!args.isWatched && args.seasons.length > 0)) {
      // Clear ALL watched episodes for this show.
      // This handles orphaned records from changed TMDB data and
      // ensures consistency when leaving completion states.
      for (const ep of allExisting) {
        if (ep.isWatched) {
          await ctx.db.patch(ep._id, {
            isWatched: false,
            updatedAt: now,
          });
        }
      }
    } else {
      // Mark specific episodes as watched (or no-op for empty seasons)
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

// Batch mark episodes watched (e.g. for a whole season)
// Bulk-fetches existing records then writes only deltas (avoids N+1 queries).
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

    // Bulk-fetch all existing episode records for this show in one query
    const allExisting = await ctx.db
      .query("episode_progress")
      .withIndex("by_user_media", (q) =>
        q.eq("userId", user._id).eq("tmdbId", args.tmdbId),
      )
      .collect();

    // Build lookup map for O(1) access: "season:episode" -> record
    const existingMap = new Map<string, (typeof allExisting)[0]>();
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

// ── Status migration ────────────────────────────────────────────────────
// Migrates old progressStatus values to new names. Idempotent.
export const migrateStatusCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const items = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();
    let migrated = 0;

    for (const item of items) {
      const normalized = normalizeProgressStatus(item.progressStatus);
      if (normalized && normalized !== item.progressStatus) {
        await ctx.db.patch(item._id, {
          progressStatus: normalized,
          updatedAt: now,
        });
        migrated++;
      }
    }

    return { migrated, total: items.length };
  },
});

// ── Custom Lists CRUD ───────────────────────────────────────────────────
export const getCustomLists = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return ctx.db
      .query("lists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const createCustomList = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

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
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

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
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

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

    return ctx.db
      .query("list_items")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();
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
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

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
    });
    return true;
  },
});
