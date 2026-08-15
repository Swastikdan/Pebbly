import * as v from "valibot";
import { mediaTypeSchema } from "./common";

export const recommendationSchema = v.object({
	title: v.string(),
	tmdbId: v.nullable(v.number()),
	mediaType: mediaTypeSchema,
	relevanceScore: v.number(),
	reasoning: v.string(),
});
export type Recommendation = v.InferOutput<typeof recommendationSchema>;

export const inputStatsSchema = v.object({
	movieCount: v.number(),
	tvCount: v.number(),
	episodesWatched: v.number(),
	totalItems: v.number(),
});
export type InputStats = v.InferOutput<typeof inputStatsSchema>;

export const generateRecommendationsArgsSchema = v.object({
	generationType: v.optional(v.string()),
	listId: v.optional(v.string()),
	mediaTypePreference: v.optional(mediaTypeSchema),
	genrePreference: v.optional(v.string()),
	excludeTmdbIds: v.optional(v.array(v.number())),
	yearFrom: v.optional(v.number()),
	yearTo: v.optional(v.number()),
	count: v.optional(v.number()),
});
export type GenerateRecommendationsArgs = v.InferOutput<
	typeof generateRecommendationsArgsSchema
>;

export type GenerateResult =
	| {
			recommendations: Recommendation[];
			inputStats: InputStats;
			generatedAt: number;
			cached: boolean;
	  }
	| { error: string };

export const deleteRecommendationArgsSchema = v.object({
	id: v.string(),
});
export type DeleteRecommendationArgs = v.InferOutput<
	typeof deleteRecommendationArgsSchema
>;

export const updateVerifiedRecommendationsArgsSchema = v.object({
	id: v.string(),
	recommendations: v.string(),
});
export type UpdateVerifiedRecommendationsArgs = v.InferOutput<
	typeof updateVerifiedRecommendationsArgsSchema
>;

export const setRecommendationFeedbackArgsSchema = v.object({
	tmdbId: v.number(),
	mediaType: mediaTypeSchema,
	title: v.string(),
	feedback: v.picklist(["not_interested", "like"]),
	image: v.optional(v.string()),
	backdrop: v.optional(v.string()),
	rating: v.optional(v.number()),
	release_date: v.optional(v.string()),
	overview: v.optional(v.string()),
});
export type SetRecommendationFeedbackArgs = v.InferOutput<
	typeof setRecommendationFeedbackArgsSchema
>;

export const removeRecommendationFeedbackArgsSchema = v.object({
	tmdbId: v.number(),
	mediaType: mediaTypeSchema,
});
export type RemoveRecommendationFeedbackArgs = v.InferOutput<
	typeof removeRecommendationFeedbackArgsSchema
>;

export const getHomepageRecommendationsArgsSchema = v.object({
	now: v.optional(v.number()),
});
export type GetHomepageRecommendationsArgs = v.InferOutput<
	typeof getHomepageRecommendationsArgsSchema
>;

export type HomepageRecommendationsResult = {
	recommendations: Recommendation[];
	lastUpdatedAt: number;
	lastAttemptedAt: number;
	status: string;
	needsRefresh: boolean;
};

export const getUserRecommendationAccessResultSchema = v.variant("hasAccess", [
	v.object({ hasAccess: v.literal(true) }),
	v.object({
		hasAccess: v.literal(false),
		reason: v.picklist(["not_authenticated", "feature_disabled"]),
	}),
]);
export type UserRecommendationAccessResult = v.InferOutput<
	typeof getUserRecommendationAccessResultSchema
>;
