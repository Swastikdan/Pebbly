import { z } from "zod";
import {
	mediaTypeSchema,
	metadataSchema,
	progressStatusSchema,
	reactionSchema,
} from "./common";

export const getWatchlistArgsSchema = z.object({
	limit: z.number().optional(),
	statusFilter: z.string().optional(),
});
export type GetWatchlistArgs = z.infer<typeof getWatchlistArgsSchema>;

export const mediaIdentityArgsSchema = z.object({
	tmdbId: z.number(),
	mediaType: mediaTypeSchema,
});
export type MediaIdentityArgs = z.infer<typeof mediaIdentityArgsSchema>;

export const setWatchlistMembershipArgsSchema = mediaIdentityArgsSchema
	.extend({
		inWatchlist: z.boolean(),
	})
	.merge(metadataSchema);
export type SetWatchlistMembershipArgs = z.infer<
	typeof setWatchlistMembershipArgsSchema
>;

export const setProgressStatusArgsSchema = mediaIdentityArgsSchema
	.extend({
		progressStatus: progressStatusSchema,
		progress: z.number().optional(),
	})
	.merge(metadataSchema);
export type SetProgressStatusArgs = z.infer<typeof setProgressStatusArgsSchema>;

export const setReactionArgsSchema = mediaIdentityArgsSchema
	.extend({
		reaction: reactionSchema.optional(),
		clearReaction: z.boolean().optional(),
	})
	.merge(metadataSchema);
export type SetReactionArgs = z.infer<typeof setReactionArgsSchema>;

export const updateProgressArgsSchema = mediaIdentityArgsSchema
	.extend({
		progress: z.number().optional(),
		isWatched: z.boolean().optional(),
	})
	.merge(metadataSchema);
export type UpdateProgressArgs = z.infer<typeof updateProgressArgsSchema>;

export const markEpisodeWatchedArgsSchema = z.object({
	tmdbId: z.number(),
	season: z.number(),
	episode: z.number(),
	isWatched: z.boolean(),
});
export type MarkEpisodeWatchedArgs = z.infer<
	typeof markEpisodeWatchedArgsSchema
>;

export const markSeasonEpisodesWatchedArgsSchema = z.object({
	tmdbId: z.number(),
	season: z.number(),
	episodes: z.array(z.number()),
	isWatched: z.boolean(),
});
export type MarkSeasonEpisodesWatchedArgs = z.infer<
	typeof markSeasonEpisodesWatchedArgsSchema
>;

export const markShowEpisodesAndStatusArgsSchema = z
	.object({
		tmdbId: z.number(),
		mediaType: mediaTypeSchema,
		seasons: z.array(
			z.object({
				season: z.number(),
				episodes: z.array(z.number()),
			}),
		),
		isWatched: z.boolean(),
		clearAllEpisodes: z.boolean().optional(),
		progressStatus: progressStatusSchema.optional(),
		progress: z.number().optional(),
	})
	.merge(metadataSchema);
export type MarkShowEpisodesAndStatusArgs = z.infer<
	typeof markShowEpisodesAndStatusArgsSchema
>;
