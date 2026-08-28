import type { RecommendationCandidate, WatchlistData } from "./prompts";
import type { MediaType } from "@/lib/media-types";
import {
  getMedia,
  getMovieRecommendations,
  getTvSeriesRecommendations,
} from "@/lib/queries";
import { normalizeTitleKey } from "@/lib/text";

type CandidateSource = "popular" | "seed" | "trending";

type RawCandidate = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  releaseDate: string;
  rating: number;
  voteCount: number;
  popularity: number;
  posterPath: string | null;
  genreIds: number[];
  source: CandidateSource;
};

export type CandidateGenerationOptions = {
  watchItems: WatchlistData["watchItems"];
  mediaTypePreference?: MediaType;
  excludeTmdbIds: number[];
  excludeTitles: string[];
  seedItems?: Array<{ tmdbId: number; mediaType: MediaType }>;
  yearFrom?: number;
  yearTo?: number;
  limit?: number;
  balanced?: boolean;
};

const MAX_SEED_TITLES = 2;
const DEFAULT_CANDIDATE_LIMIT = 40;
const HOMEPAGE_CANDIDATE_LIMIT = 60;

function yearOf(date: string): number | null {
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isInteger(year) && year >= 1800 ? year : null;
}

function candidateKey(mediaType: MediaType, tmdbId: number) {
  return `${mediaType}:${tmdbId}`;
}

type TmdbCandidateItem = {
  id: number;
  title?: string;
  original_title?: string;
  name?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  media_type?: string;
  genre_ids?: number[] | null;
};

function toMovieCandidate(
  item: TmdbCandidateItem,
  source: CandidateSource,
): RawCandidate | null {
  const title = item.title ?? item.original_title ?? "";
  if (!title || !item.id || !item.poster_path || item.vote_average <= 0) {
    return null;
  }
  return {
    tmdbId: item.id,
    mediaType: "movie",
    title,
    releaseDate: item.release_date ?? "",
    rating: item.vote_average,
    voteCount: item.vote_count,
    popularity: item.popularity,
    posterPath: item.poster_path,
    genreIds: item.genre_ids ?? [],
    source,
  };
}

function toTvCandidate(
  item: TmdbCandidateItem,
  source: CandidateSource,
): RawCandidate | null {
  const title = item.name ?? item.original_name ?? "";
  if (!title || !item.id || !item.poster_path || item.vote_average <= 0) {
    return null;
  }
  return {
    tmdbId: item.id,
    mediaType: "tv",
    title,
    releaseDate: item.first_air_date ?? "",
    rating: item.vote_average,
    voteCount: item.vote_count,
    popularity: item.popularity,
    posterPath: item.poster_path,
    genreIds: item.genre_ids ?? [],
    source,
  };
}

function scoreCandidate(candidate: RawCandidate, maxPopularity: number) {
  const ratingScore = Math.min(candidate.rating / 10, 1);
  const voteScore = Math.min(Math.log10(candidate.voteCount + 1) / 5, 1);
  const popularityScore = Math.min(
    Math.log10(candidate.popularity + 1) /
      Math.max(Math.log10(maxPopularity + 1), 1),
    1,
  );
  const year = yearOf(candidate.releaseDate);
  const currentYear = new Date().getUTCFullYear();
  const freshnessScore = year
    ? Math.max(0, 1 - Math.min(Math.abs(currentYear - year), 20) / 20)
    : 0;
  const sourceScore =
    candidate.source === "seed"
      ? 1
      : candidate.source === "trending"
        ? 0.05
        : 0;

  return (
    ratingScore * 0.42 +
    voteScore * 0.25 +
    popularityScore * 0.15 +
    freshnessScore * 0.08 +
    sourceScore * 0.1
  );
}

function interleaveByMediaType(
  candidates: RawCandidate[],
  limit: number,
): RawCandidate[] {
  const movies = candidates.filter(
    (candidate) => candidate.mediaType === "movie",
  );
  const tv = candidates.filter((candidate) => candidate.mediaType === "tv");
  const result: RawCandidate[] = [];
  let movieIndex = 0;
  let tvIndex = 0;

  while (
    result.length < limit &&
    (movieIndex < movies.length || tvIndex < tv.length)
  ) {
    if (movieIndex < movies.length) result.push(movies[movieIndex++]);
    if (result.length >= limit) break;
    if (tvIndex < tv.length) result.push(tv[tvIndex++]);
  }

  return result;
}

function toPromptCandidate(candidate: RawCandidate): RecommendationCandidate {
  return {
    tmdbId: candidate.tmdbId,
    mediaType: candidate.mediaType,
    title: candidate.title,
    year: yearOf(candidate.releaseDate),
    rating: Math.round(candidate.rating * 10) / 10,
    voteCount: candidate.voteCount,
  };
}

export async function getRecommendationCandidates(
  options: CandidateGenerationOptions,
): Promise<RecommendationCandidate[]> {
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_CANDIDATE_LIMIT, 20),
    HOMEPAGE_CANDIDATE_LIMIT,
  );
  const mediaTypes: Array<"movies_popular" | "tv-shows_popular"> =
    options.mediaTypePreference === "movie"
      ? ["movies_popular"]
      : options.mediaTypePreference === "tv"
        ? ["tv-shows_popular"]
        : ["movies_popular", "tv-shows_popular"];

  const [popularResults, trendingResults] = await Promise.all([
    Promise.all(
      mediaTypes.map(async (type) => {
        try {
          return await getMedia({ type, page: 1 });
        } catch (error) {
          console.warn(
            `[recommendations] TMDB ${type} candidates failed`,
            error,
          );
          return [];
        }
      }),
    ),
    getMedia({ type: "trending_week", page: 1 }).catch((error) => {
      console.warn("[recommendations] TMDB trending candidates failed", error);
      return [];
    }),
  ]);

  const seeds = [
    ...(options.seedItems ?? []),
    ...options.watchItems
      .filter(
        (item) =>
          item.reaction === "loved" ||
          item.reaction === "liked" ||
          item.reaction === "recommended",
      )
      .map((item) => ({ tmdbId: item.tmdbId, mediaType: item.mediaType })),
  ]
    .filter(
      (seed) =>
        !options.mediaTypePreference ||
        seed.mediaType === options.mediaTypePreference,
    )
    .filter(
      (seed, index, all) =>
        all.findIndex(
          (other) =>
            other.tmdbId === seed.tmdbId && other.mediaType === seed.mediaType,
        ) === index,
    )
    .slice(0, MAX_SEED_TITLES);
  const seedResults = await Promise.all(
    seeds.map(async (seed) => {
      try {
        return seed.mediaType === "movie"
          ? await getMovieRecommendations({ id: seed.tmdbId, page: 1 })
          : await getTvSeriesRecommendations({ id: seed.tmdbId, page: 1 });
      } catch (error) {
        console.warn(
          `[recommendations] TMDB ${seed.mediaType}/${seed.tmdbId} candidates failed`,
          error,
        );
        return null;
      }
    }),
  );

  const rawCandidates: RawCandidate[] = [];
  for (const [index, items] of popularResults.entries()) {
    for (const item of items) {
      const candidate =
        mediaTypes[index] === "movies_popular"
          ? toMovieCandidate(item, "popular")
          : toTvCandidate(item, "popular");
      if (candidate) rawCandidates.push(candidate);
    }
  }
  for (const [index, result] of seedResults.entries()) {
    if (!result) continue;
    for (const item of result.results ?? []) {
      const candidate =
        seeds[index].mediaType === "movie"
          ? toMovieCandidate(item, "seed")
          : toTvCandidate(item, "seed");
      if (candidate) rawCandidates.push(candidate);
    }
  }

  for (const item of trendingResults) {
    const trendingType =
      item.media_type === "movie" || item.media_type === "tv"
        ? item.media_type
        : null;
    if (
      !trendingType ||
      (options.mediaTypePreference &&
        trendingType !== options.mediaTypePreference)
    ) {
      continue;
    }
    const candidate =
      trendingType === "movie"
        ? toMovieCandidate(item, "trending")
        : toTvCandidate(item, "trending");
    if (candidate) rawCandidates.push(candidate);
  }

  const excludedIds = new Set([
    ...options.excludeTmdbIds,
    ...options.watchItems.map((item) => item.tmdbId),
  ]);
  const excludedTitles = new Set(
    [
      ...options.excludeTitles,
      ...options.watchItems
        .map((item) => item.title)
        .filter((title): title is string => !!title),
    ].map(normalizeTitleKey),
  );
  const byIdentity = new Map<string, RawCandidate>();
  for (const candidate of rawCandidates) {
    const year = yearOf(candidate.releaseDate);
    if (
      excludedIds.has(candidate.tmdbId) ||
      excludedTitles.has(normalizeTitleKey(candidate.title)) ||
      (options.yearFrom !== undefined &&
        (year === null || year < options.yearFrom)) ||
      (options.yearTo !== undefined && (year === null || year > options.yearTo))
    ) {
      continue;
    }
    const key = candidateKey(candidate.mediaType, candidate.tmdbId);
    const existing = byIdentity.get(key);
    if (!existing || candidate.source === "seed")
      byIdentity.set(key, candidate);
  }

  const uniqueCandidates = [...byIdentity.values()];
  const maxPopularity = Math.max(
    ...uniqueCandidates.map((item) => item.popularity),
    1,
  );
  const ranked = uniqueCandidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, maxPopularity),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
  const selected = options.balanced
    ? interleaveByMediaType(ranked, limit)
    : ranked.slice(0, limit);

  return selected.map(toPromptCandidate);
}

export function candidateIdentity(
  candidate: Pick<RecommendationCandidate, "mediaType" | "tmdbId">,
) {
  return candidateKey(candidate.mediaType, candidate.tmdbId);
}
