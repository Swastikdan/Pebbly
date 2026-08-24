import * as v from "valibot";

import { mediaTypeSchema } from "./common";

export const IMPORT_BATCH_SIZE = 1_000;
const MAX_ITEMS = IMPORT_BATCH_SIZE;
const MAX_WATCHED_EPISODES = 50_000;
const MAX_STRING_LEN = 500;
const MAX_OVERVIEW_LEN = 2_000;

const boundedString = (max: number) =>
  v.pipe(
    v.string(),
    v.transform((value) => (value.length > max ? value.slice(0, max) : value)),
  );

export const importItemSchema = v.object({
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  mediaType: mediaTypeSchema,
  title: boundedString(MAX_STRING_LEN),
  image: v.optional(v.nullable(boundedString(MAX_STRING_LEN))),
  rating: v.optional(
    v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(10))),
  ),
  release_date: v.optional(v.nullable(boundedString(MAX_STRING_LEN))),
  overview: v.optional(v.nullable(boundedString(MAX_OVERVIEW_LEN))),
  inWatchlist: v.optional(v.nullable(v.boolean())),
  progressStatus: v.optional(v.nullable(boundedString(20))),
  progress: v.optional(
    v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
  ),
  reaction: v.optional(v.nullable(boundedString(20))),
});
export type ImportItem = v.InferOutput<typeof importItemSchema>;

export const watchedEpisodeSchema = v.object({
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  season: v.pipe(v.number(), v.integer(), v.minValue(0)),
  episode: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type WatchedEpisode = v.InferOutput<typeof watchedEpisodeSchema>;

export const importWatchlistArgsSchema = v.object({
  items: v.pipe(v.array(importItemSchema), v.maxLength(MAX_ITEMS)),
  watchedEpisodes: v.pipe(
    v.array(watchedEpisodeSchema),
    v.maxLength(MAX_WATCHED_EPISODES),
  ),
  final: v.optional(v.boolean()),
});
export type ImportWatchlistArgs = v.InferOutput<
  typeof importWatchlistArgsSchema
>;
