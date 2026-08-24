import * as v from "valibot";

import {
  mediaTypeSchema,
  metadataSchema,
  progressStatusSchema,
  reactionSchema,
} from "./common";

export const getWatchlistArgsSchema = v.object({
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)),
  ),
  statusFilter: v.optional(progressStatusSchema),
});
export type GetWatchlistArgs = v.InferOutput<typeof getWatchlistArgsSchema>;

export const mediaIdentityArgsSchema = v.object({
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  mediaType: mediaTypeSchema,
});
export type MediaIdentityArgs = v.InferOutput<typeof mediaIdentityArgsSchema>;

export const setWatchlistMembershipArgsSchema = v.object({
  ...mediaIdentityArgsSchema.entries,
  ...metadataSchema.entries,
  inWatchlist: v.boolean(),
});
export type SetWatchlistMembershipArgs = v.InferOutput<
  typeof setWatchlistMembershipArgsSchema
>;

// Bound the batch so a single request cannot exceed the D1/Worker budget.
export const BATCH_ITEMS_MAX = 100;
export const batchSetWatchlistMembershipArgsSchema = v.object({
  items: v.pipe(
    v.array(setWatchlistMembershipArgsSchema),
    v.maxLength(BATCH_ITEMS_MAX),
  ),
});
export type BatchSetWatchlistMembershipArgs = v.InferOutput<
  typeof batchSetWatchlistMembershipArgsSchema
>;

export const setProgressStatusArgsSchema = v.object({
  ...mediaIdentityArgsSchema.entries,
  ...metadataSchema.entries,
  progressStatus: progressStatusSchema,
  progress: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
});
export type SetProgressStatusArgs = v.InferOutput<
  typeof setProgressStatusArgsSchema
>;

export const setReactionArgsSchema = v.object({
  ...mediaIdentityArgsSchema.entries,
  ...metadataSchema.entries,
  reaction: v.optional(reactionSchema),
  clearReaction: v.optional(v.boolean()),
});
export type SetReactionArgs = v.InferOutput<typeof setReactionArgsSchema>;

export const updateProgressArgsSchema = v.object({
  ...mediaIdentityArgsSchema.entries,
  ...metadataSchema.entries,
  progress: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
  isWatched: v.optional(v.boolean()),
});
export type UpdateProgressArgs = v.InferOutput<typeof updateProgressArgsSchema>;

export const markEpisodeWatchedArgsSchema = v.object({
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  season: v.pipe(v.number(), v.integer(), v.minValue(0)),
  episode: v.pipe(v.number(), v.integer(), v.minValue(1)),
  isWatched: v.boolean(),
});
export type MarkEpisodeWatchedArgs = v.InferOutput<
  typeof markEpisodeWatchedArgsSchema
>;

export const markSeasonEpisodesWatchedArgsSchema = v.object({
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  season: v.pipe(v.number(), v.integer(), v.minValue(0)),
  episodes: v.pipe(
    v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
    // Long-running shows can exceed 1000 episodes in one season; the cap
    // only guards against abuse-sized payloads, not real seasons.
    v.maxLength(5000),
  ),
  isWatched: v.boolean(),
});
export type MarkSeasonEpisodesWatchedArgs = v.InferOutput<
  typeof markSeasonEpisodesWatchedArgsSchema
>;

export const markShowEpisodesAndStatusArgsSchema = v.object({
  ...metadataSchema.entries,
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  mediaType: mediaTypeSchema,
  seasons: v.pipe(
    v.array(
      v.object({
        season: v.pipe(v.number(), v.integer(), v.minValue(0)),
        episodes: v.pipe(
          v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
          v.maxLength(5000),
        ),
      }),
    ),
    v.maxLength(100),
  ),
  isWatched: v.boolean(),
  clearAllEpisodes: v.optional(v.boolean()),
  progressStatus: v.optional(progressStatusSchema),
  progress: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
});
export type MarkShowEpisodesAndStatusArgs = v.InferOutput<
  typeof markShowEpisodesAndStatusArgsSchema
>;
