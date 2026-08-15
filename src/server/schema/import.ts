import * as v from "valibot";
import { mediaTypeSchema } from "./common";

export const importItemSchema = v.object({
	tmdbId: v.number(),
	mediaType: mediaTypeSchema,
	title: v.string(),
	image: v.optional(v.string()),
	rating: v.optional(v.number()),
	release_date: v.optional(v.string()),
	overview: v.optional(v.string()),
	progressStatus: v.optional(v.nullable(v.string())),
	progress: v.optional(v.number()),
	reaction: v.optional(v.nullable(v.string())),
});
export type ImportItem = v.InferOutput<typeof importItemSchema>;

export const watchedEpisodeSchema = v.object({
	tmdbId: v.number(),
	season: v.number(),
	episode: v.number(),
});
export type WatchedEpisode = v.InferOutput<typeof watchedEpisodeSchema>;

export const importWatchlistArgsSchema = v.object({
	items: v.array(importItemSchema),
	watchedEpisodes: v.array(watchedEpisodeSchema),
});
export type ImportWatchlistArgs = v.InferOutput<
	typeof importWatchlistArgsSchema
>;
