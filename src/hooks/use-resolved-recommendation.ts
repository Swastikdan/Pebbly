import type { NormalizedTmdbData } from "@/hooks/use-tmdb-verification";
import type { AIRecommendation } from "@/types";
import {
  titlesMatch,
  useTmdbData,
  useTmdbSearchFallback,
} from "@/hooks/use-tmdb-verification";

export interface ResolvedRecommendation {
  resolvedData: NormalizedTmdbData | null;
  isResolving: boolean;
}

export function useResolvedRecommendation(
  recommendation: AIRecommendation,
  options?: { enabled?: boolean },
): ResolvedRecommendation {
  const { title, tmdbId, mediaType } = recommendation;
  const enabled = options?.enabled ?? true;

  const {
    data: tmdbData,
    isLoading: idLoading,
    exists: idExists,
  } = useTmdbData(enabled ? tmdbId : null, mediaType);

  const idVerified =
    enabled &&
    !!tmdbData &&
    idExists &&
    titlesMatch(title, tmdbData.title) &&
    tmdbData.rating > 0 &&
    !!tmdbData.posterPath;
  const idResolved = !enabled || !tmdbId || !idLoading;

  const shouldSearch = enabled && idResolved && !idVerified;
  const {
    data: searchData,
    isLoading: searchLoading,
    exists: searchExists,
  } = useTmdbSearchFallback(title, mediaType, shouldSearch);

  const resolvedData = enabled
    ? idVerified
      ? tmdbData
      : searchExists
        ? searchData
        : null
    : null;

  const isResolving =
    enabled && ((!!tmdbId && idLoading) || (shouldSearch && searchLoading));

  return { resolvedData, isResolving };
}
