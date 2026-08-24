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

// A heavy user's tracked library alone can exceed a few hundred titles, so the
// cap must sit well above realistic watchlist sizes — it only guards against
// unbounded payloads, not normal usage.
export const MAX_EXCLUDE_TMDB_IDS = 1000;

export const generateRecommendationsArgsSchema = v.object({
  generationType: v.optional(generationTypeSchema),
  listId: v.optional(v.string()),
  mediaTypePreference: v.optional(mediaTypeSchema),
  genrePreference: v.optional(v.string()),
  excludeTmdbIds: v.optional(
    v.pipe(v.array(v.number()), v.maxLength(MAX_EXCLUDE_TMDB_IDS)),
  ),
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

// `rating` must stay within the watch_items CHECK constraint (0..10): unlike
// the other write paths, setRecommendationFeedback inserts the rating directly
// into watch_items without buildMetadataPatch's clamp, so an out-of-range
// value would violate the constraint and 500 the request.
export const setRecommendationFeedbackArgsSchema = v.object({
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  mediaType: mediaTypeSchema,
  title: v.pipe(v.string(), v.maxLength(500)),
  feedback: v.picklist(["not_interested", "like"]),
  image: v.optional(v.pipe(v.string(), v.maxLength(500))),
  backdrop: v.optional(v.pipe(v.string(), v.maxLength(500))),
  rating: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(10))),
  release_date: v.optional(v.pipe(v.string(), v.maxLength(500))),
  overview: v.optional(v.pipe(v.string(), v.maxLength(500))),
});
export type SetRecommendationFeedbackArgs = v.InferOutput<
  typeof setRecommendationFeedbackArgsSchema
>;

export const removeRecommendationFeedbackArgsSchema = v.object({
  tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
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
