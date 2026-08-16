import * as v from "valibot";
import { mediaTypeSchema } from "./common";

export const recommendationSchema = v.object({
	title: v.string(),
	tmdbId: v.nullable(v.number()),
	mediaType: mediaTypeSchema,
	relevanceScore: v.number(),
	reasoning: v.string(),
});

export const recommendationsArraySchema = v.array(recommendationSchema);
export type Recommendation = v.InferOutput<typeof recommendationSchema>;

export const inputStatsSchema = v.object({
	movieCount: v.number(),
	tvCount: v.number(),
	episodesWatched: v.number(),
	totalItems: v.number(),
});
export type InputStats = v.InferOutput<typeof inputStatsSchema>;

export const generationTypeSchema = v.picklist(["watchlist", "list", "genre"]);

export const generateRecommendationsArgsSchema = v.object({
	generationType: v.optional(generationTypeSchema),
	listId: v.optional(v.string()),
	mediaTypePreference: v.optional(mediaTypeSchema),
	genrePreference: v.optional(v.string()),
	excludeTmdbIds: v.optional(v.pipe(v.array(v.number()), v.maxLength(100))),
	yearFrom: v.optional(
		v.pipe(v.number(), v.integer(), v.minValue(1900), v.maxValue(2100)),
	),
	yearTo: v.optional(
		v.pipe(v.number(), v.integer(), v.minValue(1900), v.maxValue(2100)),
	),
	count: v.optional(
		v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(30)),
	),
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
