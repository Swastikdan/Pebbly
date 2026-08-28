import type { AIRecommendation } from "@/hooks/use-tmdb-verification";

/**
 * Stable identifier for a recommendation row in the local dismiss cache.
 * Includes the title because the same TMDB id can be surfaced by multiple
 * generations and should remain dismissible per surfacing.
 */
export const getDismissKey = (rec: AIRecommendation) =>
  `${rec.mediaType}:${rec.tmdbId ?? ""}:${rec.title}`;

export interface RecommendationFilterSets {
  /** Keys from `getDismissKey` that the user dismissed in this session. */
  dismissedKeys: Set<string>;
  /** `${mediaType}:${tmdbId}` keys the user thumbs-downed server-side. */
  dislikedKeys: Set<string>;
  /** `${mediaType}:${tmdbId}` keys already in the user's watchlist. */
  watchlistKeys: Set<string>;
  /** `${mediaType}:${tmdbId}` keys the user thumbs-upped in this session. */
  likedKeys: Set<string>;
}

/**
 * Filter the raw homepage rail to what should actually render:
 *  - drop locally dismissed rows,
 *  - drop rows the user has disliked (server feedback),
 *  - drop rows already in the watchlist — UNLESS the user also liked that
 *    exact row in this session (an explicit like should win over membership).
 *
 * Pure function so it is covered by unit tests independent of the component.
 */
export function filterRenderedRecommendations(
  recommendations: AIRecommendation[] | null | undefined,
  {
    dismissedKeys,
    dislikedKeys,
    watchlistKeys,
    likedKeys,
  }: RecommendationFilterSets,
): AIRecommendation[] {
  if (!recommendations) return [];
  return recommendations.filter((r) => {
    if (dismissedKeys.has(getDismissKey(r))) return false;
    if (r.tmdbId !== null && r.tmdbId !== undefined) {
      const key = `${r.mediaType}:${r.tmdbId}`;
      if (dislikedKeys.has(key)) return false;
      if (watchlistKeys.has(key) && !likedKeys.has(key)) return false;
    }
    return true;
  });
}
