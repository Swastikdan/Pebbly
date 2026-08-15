import { z } from "zod";
import {
	mediaTypeSchema,
	progressStatusSchema,
	reactionSchema,
} from "./common";

export const importItemSchema = z.object({
	tmdbId: z.number(),
	mediaType: mediaTypeSchema,
	title: z.string(),
	image: z.string().optional(),
	rating: z.number().optional(),
	release_date: z.string().optional(),
	overview: z.string().optional(),
	progressStatus: progressStatusSchema.optional(),
	progress: z.number().optional(),
	reaction: reactionSchema.nullable().optional(),
});
export type ImportItem = z.infer<typeof importItemSchema>;

export const watchedEpisodeSchema = z.object({
	tmdbId: z.number(),
	season: z.number(),
	episode: z.number(),
});
export type WatchedEpisode = z.infer<typeof watchedEpisodeSchema>;

export const importWatchlistArgsSchema = z.object({
	items: z.array(importItemSchema),
	watchedEpisodes: z.array(watchedEpisodeSchema),
});
export type ImportWatchlistArgs = z.infer<typeof importWatchlistArgsSchema>;
