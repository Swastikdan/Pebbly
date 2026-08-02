import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  type WatchItem,
  buildMetadataPatch,
  MEDIA_TYPE_VALIDATOR,
  PROGRESS_STATUS_VALIDATOR,
  REACTION_OR_NULL_VALIDATOR,
  type MediaType,
} from "./helpers/watch-item";
import { syncEpisodeProgressRecord } from "./episode-progress";
import { createWatchlistSnapshot } from "./watchlist";

type ImportWatchlistItem = {
  tmdbId: number;
  mediaType: string;
  title: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
  progressStatus?: string;
  progress?: number;
  reaction?: "loved" | "liked" | "mixed" | "not-for-me" | null;
};

const IMPORT_ITEM_VALIDATOR = v.object({
  tmdbId: v.number(),
  mediaType: MEDIA_TYPE_VALIDATOR,
  title: v.string(),
  image: v.optional(v.string()),
  rating: v.optional(v.number()),
  release_date: v.optional(v.string()),
  overview: v.optional(v.string()),
  progressStatus: v.optional(PROGRESS_STATUS_VALIDATOR),
  progress: v.optional(v.number()),
  reaction: v.optional(REACTION_OR_NULL_VALIDATOR),
});

export const importWatchlist = mutation({
  args: {
    items: v.array(IMPORT_ITEM_VALIDATOR),
    watchedEpisodes: v.array(
      v.object({
        tmdbId: v.number(),
        season: v.number(),
        episode: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const now = Date.now();
    const importedItems = new Map<string, ImportWatchlistItem>();

    for (const item of args.items) {
      importedItems.set(`${item.mediaType}:${item.tmdbId}`, item);
    }

    const userWatchItems = await ctx.db
      .query("watch_items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingMap = new Map<string, WatchItem>();
    for (const item of userWatchItems) {
      existingMap.set(`${item.mediaType}:${item.tmdbId}`, item);
    }

    for (const item of importedItems.values()) {
      const existing = existingMap.get(`${item.mediaType}:${item.tmdbId}`);
      const progressStatus = item.progressStatus ?? "watch-later";
      const progress =
        item.progress ??
        (progressStatus === "done"
          ? 100
          : progressStatus === "watch-later"
            ? 0
            : existing?.progress);
      const metadata = buildMetadataPatch(item, existing ?? undefined);

      if (existing) {
        await ctx.db.patch(existing._id, {
          inWatchlist: true,
          progressStatus,
          progress,
          reaction: item.reaction ?? existing.reaction ?? null,
          updatedAt: now,
          ...metadata,
        });
      } else {
        await ctx.db.insert("watch_items", {
          userId: user._id,
          tmdbId: item.tmdbId,
          mediaType: item.mediaType as MediaType,
          inWatchlist: true,
          progressStatus,
          progress,
          reaction: item.reaction ?? null,
          updatedAt: now,
          ...metadata,
        });
      }
    }

    const importedTvIds = new Set(
      [...importedItems.values()]
        .filter((item) => item.mediaType === "tv")
        .map((item) => item.tmdbId),
    );
    const episodeKeys = new Set<string>();
    for (const episode of args.watchedEpisodes) {
      if (!importedTvIds.has(episode.tmdbId)) continue;
      const key = `${episode.tmdbId}:${episode.season}:${episode.episode}`;
      if (episodeKeys.has(key)) continue;
      episodeKeys.add(key);
      await syncEpisodeProgressRecord(ctx, user._id, {
        ...episode,
        isWatched: true,
      }, now);
    }

    await createWatchlistSnapshot(ctx, user._id);
    return { imported: importedItems.size };
  },
});
