import type { MediaType } from "@/domain/media";
import type { AIRecommendation } from "@/domain/recommendations";
import { GENRE_LIST } from "@/constants";
import { ERA_PRESETS } from "@/lib/recommendation-eras";
import { normalizeTitleKey } from "@/lib/text";
import { MAX_EXCLUDE_TMDB_IDS } from "@/server/schema/recommendations";

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

// ---------------------------------------------------------------------------
// Generation options builders (pure; consumed by `use-recommendations`).
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  generationType?: "watchlist" | "list" | "genre";
  listId?: string;
  mediaTypePreference?: MediaType;
  genrePreference?: string;
  genreIds?: number[];
  excludeTmdbIds?: number[];
  yearFrom?: number;
  yearTo?: number;
  count?: number;
}

export interface RecommendationHistoryEntry {
  id: string;
  recommendations: AIRecommendation[];
  inputStats: {
    movieCount: number;
    tvCount: number;
    episodesWatched: number;
    totalItems: number;
  };
  createdAt: number;
  generationType?: string;
  mediaTypePreference?: string;
  genrePreference?: string;
  verified?: boolean;
}

export interface TrackedContentSets {
  trackedTmdbIds: Set<number>;
  trackedTitles: Set<string>;
}

export function isTrackedRecommendation(
  recommendation: AIRecommendation,
  tracked: TrackedContentSets,
): boolean {
  const candidateIds = [
    recommendation.tmdbId,
    recommendation.verifiedTmdbId,
  ].filter((id): id is number => typeof id === "number");
  if (candidateIds.some((id) => tracked.trackedTmdbIds.has(id))) return true;

  const candidateTitles = [
    recommendation.title,
    recommendation.verifiedTitle,
  ].map(normalizeTitleKey);

  return candidateTitles.some(
    (title) => title && tracked.trackedTitles.has(title),
  );
}

export function selectUntrackedHistory(
  history: RecommendationHistoryEntry[],
  tracked: TrackedContentSets,
  filteringEnabled: boolean,
): RecommendationHistoryEntry[] {
  if (!filteringEnabled) return history;
  return history
    .map((entry) => ({
      ...entry,
      recommendations: entry.recommendations.filter(
        (r) => !isTrackedRecommendation(r, tracked),
      ),
    }))
    .filter((entry) => entry.recommendations.length > 0);
}

function cappedTrackedExclusions(
  trackedTmdbIds: Set<number>,
): number[] | undefined {
  if (trackedTmdbIds.size === 0) return undefined;
  return Array.from(trackedTmdbIds).slice(0, MAX_EXCLUDE_TMDB_IDS);
}

export interface FreshGenerateOptionsInput {
  generationType: "watchlist" | "genre" | "list";
  listId?: string;
  mediaTypePreference?: MediaType;
  selectedGenres?: string[];
  selectedEras?: string[];
  count: number;
}

export function buildGenerateOptions(
  input: FreshGenerateOptionsInput,
  trackedTmdbIds: Set<number>,
): GenerateOptions {
  const options: GenerateOptions = { generationType: input.generationType };
  if (input.generationType === "list") options.listId = input.listId;

  if (input.mediaTypePreference)
    options.mediaTypePreference = input.mediaTypePreference;
  if (input.generationType === "genre" && input.selectedGenres?.length) {
    options.genrePreference = input.selectedGenres.join(", ");
    options.genreIds = input.selectedGenres
      .map((name) => GENRE_LIST.find((genre) => genre.name === name)?.id)
      .filter((id): id is number => id !== undefined)
      .slice(0, 10);
  }

  if (input.selectedEras && input.selectedEras.length > 0) {
    const matchedEras = ERA_PRESETS.filter((e) =>
      input.selectedEras?.includes(e.label),
    );
    options.yearFrom = Math.min(...matchedEras.map((e) => e.from));
    options.yearTo = Math.max(...matchedEras.map((e) => e.to));
  }

  const exclusions = cappedTrackedExclusions(trackedTmdbIds);
  if (exclusions) options.excludeTmdbIds = exclusions;

  options.count = input.count;
  return options;
}

export interface RepeatGenerateContext {
  count: number;
  trackedTmdbIds: Set<number>;
}

function buildRepeatBaseOptions(
  entry: RecommendationHistoryEntry,
  { count, trackedTmdbIds }: RepeatGenerateContext,
): GenerateOptions {
  const options: GenerateOptions = {
    generationType: (entry.generationType || "watchlist") as
      "watchlist" | "list" | "genre",
  };
  if (entry.mediaTypePreference)
    options.mediaTypePreference = entry.mediaTypePreference as MediaType;
  if (entry.genrePreference) {
    options.genrePreference = entry.genrePreference;
    options.genreIds = entry.genrePreference
      .split(",")
      .map((name) => GENRE_LIST.find((genre) => genre.name === name.trim())?.id)
      .filter((id): id is number => id !== undefined)
      .slice(0, 10);
  }

  const exclusions = cappedTrackedExclusions(trackedTmdbIds);
  if (exclusions) options.excludeTmdbIds = exclusions;

  options.count = count;
  return options;
}

export function buildGenerateAgainOptions(
  entry: RecommendationHistoryEntry,
  context: RepeatGenerateContext,
): GenerateOptions {
  return buildRepeatBaseOptions(entry, context);
}

export function buildGenerateMoreOptions(
  entry: RecommendationHistoryEntry,
  { count, trackedTmdbIds }: RepeatGenerateContext,
): GenerateOptions {
  const options = buildRepeatBaseOptions(entry, { count, trackedTmdbIds });

  options.excludeTmdbIds = [
    ...new Set([
      ...entry.recommendations
        .flatMap((r) => [r.tmdbId, r.verifiedTmdbId])
        .filter((id): id is number => typeof id === "number"),
      ...Array.from(trackedTmdbIds),
    ]),
  ].slice(0, MAX_EXCLUDE_TMDB_IDS);

  return options;
}
