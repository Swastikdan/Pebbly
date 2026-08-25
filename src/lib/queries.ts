import type * as v from "valibot";

import type {
  MediaListResults,
  MediaListResultsEntity,
  SearchResults,
  TvSeasonDetail,
} from "./tmdb-schemas";
import type { MediaType } from "@/lib/media-types";
import type { MediaListQuery, MediaQuery } from "@/types";
import { getTmdbFetch } from "./tmdb";
import * as Schemas from "./tmdb-schemas";
import { validateId } from "./utils";

async function safeFetch<Output>(
  queryName: string,
  url: string,
  schema: unknown,
): Promise<Output> {
  try {
    return (await (
      getTmdbFetch() as (url: string, opts: unknown) => Promise<Output>
    )(url, { output: schema })) as Output;
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      console.error(`[${queryName}] ❌ Error fetching TMDB URL: "${url}"`, {
        queryName,
        url,
        fullUrl: `${import.meta.env.VITE_PUBLIC_TMDB_API_URL}${url}`,
        errorMessage: (error as Error)?.message,
        validationIssues:
          (error as { issues?: unknown })?.issues ||
          (error as { cause?: { issues?: unknown } })?.cause?.issues ||
          null,
        error,
      });
    }
    throw error;
  }
}

function idEndpoint<S extends v.GenericSchema>(
  name: string,
  schema: S,
  path: (id: number) => string,
) {
  return async ({ id }: { id: number }): Promise<v.InferOutput<S>> => {
    validateId(id);
    return await safeFetch<v.InferOutput<S>>(name, path(id), schema);
  };
}

function pagedIdEndpoint<S extends v.GenericSchema>(
  name: string,
  schema: S,
  path: (id: number, page: number) => string,
) {
  return async ({
    id,
    page,
  }: {
    id: number;
    page?: number;
  }): Promise<v.InferOutput<S>> => {
    validateId(id);
    return await safeFetch<v.InferOutput<S>>(name, path(id, page ?? 1), schema);
  };
}

function typedEndpoint<S extends v.GenericSchema>(
  name: string,
  schema: S,
  suffix: string,
) {
  return async ({
    type,
    id,
  }: {
    type: MediaType;
    id: number;
  }): Promise<v.InferOutput<S>> => {
    validateId(id);
    return await safeFetch<v.InferOutput<S>>(
      name,
      `/${type}/${id}/${suffix}`,
      schema,
    );
  };
}

type MediaListType = MediaQuery["type"] | MediaListQuery["type"];

const MEDIA_LIST_PATHS: Record<MediaListType, string> = {
  movies_popular: "/movie/popular",
  "movies_now-playing": "/movie/now_playing",
  "movies_top-rated": "/movie/top_rated",
  movies_upcoming: "/movie/upcoming",
  "tv-shows_airing-today": "/tv/airing_today",
  "tv-shows_on-the-air": "/tv/on_the_air",
  "tv-shows_popular": "/tv/popular",
  "tv-shows_top-rated": "/tv/top_rated",
  trending_day: "/trending/all/day",
  trending_week: "/trending/all/week",
};

export async function getMediaList({
  type,
  page,
}: {
  type: MediaListType;
  page?: number;
}): Promise<MediaListResults> {
  const pageNumber = page ?? 1;
  const url = `${MEDIA_LIST_PATHS[type]}?language=en-US&page=${pageNumber}`;

  return await safeFetch<MediaListResults>(
    "getMediaList",
    url,
    Schemas.MediaListResultsSchema,
  );
}

export async function getMedia({
  type,
  page,
}: {
  type: MediaListType;
  page?: number;
}): Promise<MediaListResultsEntity[]> {
  const data = await getMediaList({ type, page });
  return data.results ?? [];
}

export const getCollection = idEndpoint(
  "getCollection",
  Schemas.CollectionSchema,
  (id) => `/collection/${id}?language=en-US`,
);

export const getMovieDetails = idEndpoint(
  "getMovieDetails",
  Schemas.MovieSchema,
  (id) =>
    `/movie/${id}?language=en-US&append_to_response=images,videos,credits,release_dates,external_ids,keywords`,
);

export const getBasicMovieDetails = idEndpoint(
  "getBasicMovieDetails",
  Schemas.BasicMovieSchema,
  (id) => `/movie/${id}?language=en-US`,
);

// `recommendations` is deliberately NOT appended: media pages fetch it
// separately via getTvSeriesRecommendations, and TMDB returns a full 20-item
// result set per title, dropping it shaves ~20 objects off every detail
// payload that is otherwise cached client-side.
export const getTvDetails = idEndpoint(
  "getTvDetails",
  Schemas.TvSchema,
  (id) =>
    `/tv/${id}?language=en-US&append_to_response=images,videos,credits,external_ids,keywords,content_ratings`,
);

export const getBasicTvDetails = idEndpoint(
  "getBasicTvDetails",
  Schemas.BasicTvSchema,
  (id) => `/tv/${id}?language=en-US`,
);

export const getMovieRecommendations = pagedIdEndpoint(
  "getMovieRecommendations",
  Schemas.MovieRecommendationsSchema,
  (id, page) => `/movie/${id}/recommendations?language=en-US&page=${page}`,
);

export const getTvSeriesRecommendations = pagedIdEndpoint(
  "getTvSeriesRecommendations",
  Schemas.TvRecommendationsSchema,
  (id, page) => `/tv/${id}/recommendations?language=en-US&page=${page}`,
);

export const getCredits = typedEndpoint(
  "getCredits",
  Schemas.CreditsSchema,
  "credits?language=en-US",
);

export const getVideos = typedEndpoint(
  "getVideos",
  Schemas.MediaVideosSchema,
  "videos?language=en-US",
);

export const getImages = typedEndpoint(
  "getImages",
  Schemas.MediaImagesSchema,
  "images",
);

export const getWatchProviders = typedEndpoint(
  "getWatchProviders",
  Schemas.WatchProvidersSchema,
  "watch/providers?language=en-US",
);

export async function getDiscoverMovies({
  with_keywords,
  page,
}: {
  with_keywords: number;
  page?: number;
}): Promise<SearchResults> {
  const pageNumber = page ?? 1;
  const url = `/discover/movie?with_keywords=${with_keywords}&language=en-US&page=${pageNumber}`;

  return await safeFetch<SearchResults>(
    "getDiscoverMovies",
    url,
    Schemas.SearchResultsSchema,
  );
}

export async function getTvSeasonDetails({
  id,
  tvId,
  seasonNumber,
}: {
  id?: number;
  tvId?: number;
  seasonNumber: number;
}): Promise<TvSeasonDetail> {
  const targetId = id ?? tvId ?? 0;
  validateId(targetId);
  const url = `/tv/${targetId}/season/${seasonNumber}?language=en-US`;

  return await safeFetch<TvSeasonDetail>(
    "getTvSeasonDetails",
    url,
    Schemas.TvSeasonDetailSchema,
  );
}

export async function getSearchResult({
  query,
  page,
}: {
  query: string;
  page?: number;
}): Promise<SearchResults> {
  const pageNumber = page ?? 1;
  const url = `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=${pageNumber}`;

  return await safeFetch<SearchResults>(
    "getSearchResult",
    url,
    Schemas.SearchResultsSchema,
  );
}

// The person page only renders movie_credits + tv_credits (and external
// links). combined_credits is a third copy of the same cast/crew data and
// images is unused, so both are omitted to shrink a payload that can hold
// hundreds of credits for prolific actors.
export const getPersonDetails = idEndpoint(
  "getPersonDetails",
  Schemas.PersonDetailsSchema,
  (id) =>
    `/person/${id}?language=en-US&append_to_response=movie_credits,tv_credits,external_ids`,
);

export const getKeywordDetails = idEndpoint(
  "getKeywordDetails",
  Schemas.KeywordResultSchema,
  (id) => `/keyword/${id}`,
);
