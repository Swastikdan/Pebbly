import { z } from "zod";
import { mediaTypeSchema } from "./common";

export const recommendationSchema = z.object({
	title: z.string(),
	tmdbId: z.number().nullable(),
	mediaType: mediaTypeSchema,
	relevanceScore: z.number(),
	reasoning: z.string(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const inputStatsSchema = z.object({
	movieCount: z.number(),
	tvCount: z.number(),
	episodesWatched: z.number(),
	totalItems: z.number(),
});
export type InputStats = z.infer<typeof inputStatsSchema>;

export const generateRecommendationsArgsSchema = z.object({
	generationType: z.string().optional(),
	listId: z.string().optional(),
	mediaTypePreference: mediaTypeSchema.optional(),
	genrePreference: z.string().optional(),
	excludeTmdbIds: z.array(z.number()).optional(),
	yearFrom: z.number().optional(),
	yearTo: z.number().optional(),
	count: z.number().optional(),
});
export type GenerateRecommendationsArgs = z.infer<
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

export const deleteRecommendationArgsSchema = z.object({
	id: z.string(),
});
export type DeleteRecommendationArgs = z.infer<
	typeof deleteRecommendationArgsSchema
>;

export const updateVerifiedRecommendationsArgsSchema = z.object({
	id: z.string(),
	recommendations: z.string(),
});
export type UpdateVerifiedRecommendationsArgs = z.infer<
	typeof updateVerifiedRecommendationsArgsSchema
>;

export const setRecommendationFeedbackArgsSchema = z.object({
	tmdbId: z.number(),
	mediaType: mediaTypeSchema,
	title: z.string(),
	feedback: z.enum(["not_interested", "like"]),
	image: z.string().optional(),
	backdrop: z.string().optional(),
	rating: z.number().optional(),
	release_date: z.string().optional(),
	overview: z.string().optional(),
});
export type SetRecommendationFeedbackArgs = z.infer<
	typeof setRecommendationFeedbackArgsSchema
>;

export const removeRecommendationFeedbackArgsSchema = z.object({
	tmdbId: z.number(),
	mediaType: mediaTypeSchema,
});
export type RemoveRecommendationFeedbackArgs = z.infer<
	typeof removeRecommendationFeedbackArgsSchema
>;

export const getHomepageRecommendationsArgsSchema = z.object({
	now: z.number().optional(),
});
export type GetHomepageRecommendationsArgs = z.infer<
	typeof getHomepageRecommendationsArgsSchema
>;

export type HomepageRecommendationsResult = {
	recommendations: Recommendation[];
	lastUpdatedAt: number;
	lastAttemptedAt: number;
	status: string;
	needsRefresh: boolean;
};

export const getUserRecommendationAccessResultSchema = z.discriminatedUnion(
	"hasAccess",
	[
		z.object({ hasAccess: z.literal(true) }),
		z.object({
			hasAccess: z.literal(false),
			reason: z.enum(["not_authenticated", "feature_disabled"]),
		}),
	],
);
export type UserRecommendationAccessResult = z.infer<
	typeof getUserRecommendationAccessResultSchema
>;
