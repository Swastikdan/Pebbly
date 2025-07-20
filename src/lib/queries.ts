import type * as Types from "@/types";
import { Tmdb } from "./tmdb";
import { validateResponse, validateId } from "./utils";
export async function getMedia({
  type,
  page,
}: Types.MediaQuery): Promise<Types.MediaListResultsEntity[]> {
  const pagenumber: number = page ?? 1;
  let url = "";
  switch (type) {
    case "movies_popular":
      url = `/movie/popular?language=en-US&page=${pagenumber}`;
      break;

    case "movies_top-rated":
      url = `/movie/top_rated?language=en-US&page=${pagenumber}`;
      break;
    case "movies_upcoming":
      url = `/movie/upcoming?language=en-US&page=${pagenumber}`;
      break;

    case "tv-shows_popular":
      url = `/tv/popular?language=en-US&page=${pagenumber}`;
      break;
    case "tv-shows_top-rated":
      url = `/tv/top_rated?language=en-US&page=${pagenumber}`;
      break;
    case "trending_day":
      url = `/trending/all/day?language=en-US&page=${pagenumber}`;
      break;
    case "trending_week":
      url = `/trending/all/week?language=en-US&page=${pagenumber}`;
      break;
  }
  const response = await Tmdb<Types.MediaListResults>(url);
  const validatedResult = validateResponse(response);
  return validatedResult.results ?? [];
}
export async function getMediaList({
  type,
  page,
}: Types.MediaListQuery): Promise<Types.MediaListResults> {
  const pagenumber: number = page ?? 1;
  let url = "";
  switch (type) {
    case "movies_popular":
      url = `/movie/popular?language=en-US&page=${pagenumber}`;
      break;
    case "movies_now-playing":
      url = `/movie/now_playing?language=en-US&page=${pagenumber}`;
      break;
    case "movies_top-rated":
      url = `/movie/top_rated?language=en-US&page=${pagenumber}`;
      break;
    case "movies_upcoming":
      url = `/movie/upcoming?language=en-US&page=${pagenumber}`;
      break;
    case "tv-shows_airing-today":
      url = `/tv/airing_today?language=en-US&page=${pagenumber}`;
      break;
    case "tv-shows_on-the-air":
      url = `/tv/on_the_air?language=en-US&page=${pagenumber}`;
      break;
    case "tv-shows_popular":
      url = `/tv/popular?language=en-US&page=${pagenumber}`;
      break;
    case "tv-shows_top-rated":
      url = `/tv/top_rated?language=en-US&page=${pagenumber}`;
      break;
  }
  const response = await Tmdb<Types.MediaListResults>(url);
  const validatedResult = validateResponse(response);
  return validatedResult;
}
export async function getSearchResult(
  query: string,
  page: number,
): Promise<Types.SearchResults> {
  const pagenumber: number = page ?? 1;
  const url = `/search/multi?language=en-US&query=${query}&page=${pagenumber}`;
  const response = await Tmdb<Types.SearchResults>(url);
  const validatedResult = validateResponse(response);
  return validatedResult;
}
export async function getCollection({
  id,
}: {
  id: number;
}): Promise<Types.Collection> {
  validateId(id);
  const url = `/collection/${id}?&language=en-US&include_adult=true`;
  const response = await Tmdb<Types.Collection>(url);
  const validatedResponse = validateResponse(response);
  return validatedResponse;
}

export async function getBasicMovieDetails({
  id,
}: {
  id: number;
}): Promise<Types.BasicMovie> {
  validateId(id);
  const url = `/movie/${id}?include_adult=true`;
  const response = await Tmdb<Types.BasicMovie>(url, 1000 * 60 * 60 * 48);
  const validatedResponse = validateResponse(response);
  return validatedResponse;
}
export async function getMovieDetails({
  id,
}: {
  id: number;
}): Promise<Types.Movie> {
  validateId(id);
  const url = `/movie/${id}?include_adult=true&include_adult=true&append_to_response=external_ids,images,credits,image,videos,collections,release_dates,keywords`;
  const response = await Tmdb<Types.Movie>(url);
  const validatedResponse = validateResponse(response);
  return validatedResponse;
}

export async function getMovieRecommendations({
  id,
}: {
  id: number;
}): Promise<Types.MovieRecommendationsResultsEntity[]> {
  validateId(id);
  const url = `/movie/${id}/recommendations?&language=en-US`;
  const response = await Tmdb<Types.MovieRecommendations>(url);
  const validatedResponse = validateResponse(response);
  return validatedResponse.results ?? [];
}

export async function getTvSeriesRecommendations({
  id,
}: {
  id: number;
}): Promise<Types.TvRecommendationsResultsEntity[]> {
  validateId(id);

  const url = `/tv/${id}/recommendations?&language=en-US`;

  const response = await Tmdb<Types.TvRecommendations>(url);
  const validatedResponse = validateResponse(response);
  return validatedResponse.results ?? [];
}

export async function getCredits({
  id,
  type,
}: {
  id: number;
  type: "movie" | "tv";
}): Promise<Types.Credits> {
  validateId(id);
  const url = `/${type}/${id}/credits`;
  const response = await Tmdb<Types.Credits>(url);
  const validatedResponse = validateResponse(response);
  return validatedResponse;
}

export async function getBasicTvDetails({
  id,
}: {
  id: number;
}): Promise<Types.BasicTv> {
  validateId(id);
  const url = `/tv/${id}?&include_adult=true`;
  const response = await Tmdb<Types.BasicTv>(url, 1000 * 60 * 60 * 48);

  const validatedResponse = validateResponse(response);
  return validatedResponse;
}

export async function getTvDetails({ id }: { id: number }): Promise<Types.Tv> {
  if (id < -2147483648 || id > 2147483647) {
    throw new Error("Invalid ID");
  }
  const url = `/tv/${id}?include_adult=true&append_to_response=external_ids,images,credits,image,videos,collections,release_dates,recommendations,keywords,content_ratings`;
  const response = await Tmdb<Types.Tv>(url);

  const validatedResponse = validateResponse(response);
  return validatedResponse;
}

export async function getImages({
  id,
  type,
}: {
  id: number;
  type: "movie" | "tv";
}): Promise<Types.MediaImages> {
  const url = `/${type}/${id}/images`;
  const response = await Tmdb<Types.MediaImages>(url);
  const validatedResponse = validateResponse(response);
  return validatedResponse ?? [];
}

export async function getVideos({
  id,
  type,
}: {
  id: number;
  type: "movie" | "tv";
}): Promise<Types.MediaVideosResultsEntity[]> {
  const url = `/${type}/${id}/videos?language=en-US`;
  const response = await Tmdb<Types.MediaVideos>(url);
  const validatedResponse = validateResponse(response);
  return validatedResponse.results ?? [];
}

export async function getMediaRecommendations({
  type,
  id,
  page,
}: {
  type: string;
  id: number;
  page: number;
}) {
  const url = `/${type}/${id}/recommendations?language=en-US&page=${page}`;
  const response = await Tmdb<Types.MediaRecommendations>(url);
  const validatedResponse = validateResponse(response);
  return validatedResponse;
}
