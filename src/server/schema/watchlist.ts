import * as v from "valibot";
import {
	mediaTypeSchema,
	metadataSchema,
	progressStatusSchema,
	reactionSchema,
} from "./common";

export const getWatchlistArgsSchema = v.object({
	limit: v.optional(v.number()),
	statusFilter: v.optional(v.string()),
});
export type GetWatchlistArgs = v.InferOutput<typeof getWatchlistArgsSchema>;

export const mediaIdentityArgsSchema = v.object({
	tmdbId: v.number(),
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

export const setProgressStatusArgsSchema = v.object({
	...mediaIdentityArgsSchema.entries,
	...metadataSchema.entries,
	progressStatus: progressStatusSchema,
	progress: v.optional(v.number()),
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
	progress: v.optional(v.number()),
	isWatched: v.optional(v.boolean()),
});
export type UpdateProgressArgs = v.InferOutput<typeof updateProgressArgsSchema>;

export const markEpisodeWatchedArgsSchema = v.object({
	tmdbId: v.number(),
	season: v.number(),
	episode: v.number(),
	isWatched: v.boolean(),
});
export type MarkEpisodeWatchedArgs = v.InferOutput<
	typeof markEpisodeWatchedArgsSchema
>;

export const markSeasonEpisodesWatchedArgsSchema = v.object({
	tmdbId: v.number(),
	season: v.number(),
	episodes: v.array(v.number()),
	isWatched: v.boolean(),
});
export type MarkSeasonEpisodesWatchedArgs = v.InferOutput<
	typeof markSeasonEpisodesWatchedArgsSchema
>;

export const markShowEpisodesAndStatusArgsSchema = v.object({
	...metadataSchema.entries,
	tmdbId: v.number(),
	mediaType: mediaTypeSchema,
	seasons: v.array(
		v.object({
			season: v.number(),
			episodes: v.array(v.number()),
		}),
	),
	isWatched: v.boolean(),
	clearAllEpisodes: v.optional(v.boolean()),
	progressStatus: v.optional(progressStatusSchema),
	progress: v.optional(v.number()),
});
export type MarkShowEpisodesAndStatusArgs = v.InferOutput<
	typeof markShowEpisodesAndStatusArgsSchema
>;
