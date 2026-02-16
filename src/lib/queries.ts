import type * as Types from "@/types";

import { tmdb } from "./tmdb";
import { validateId, validateResponse } from "./utils";

/** Get only array of results from media list endpoints */
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
		default:
			throw new Error(`Unknown media type: ${type}`);
	}
	const response = await tmdb<Types.MediaListResults>(url);

	// MIGHT use validateArrayResponse here, but default is safer for type mismatch
	const result = validateResponse(response);

	return result.results ?? [];
}

/** Get full media list result object */
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
		default:
			throw new Error(`Unknown media list type: ${type}`);
	}
	const response = await tmdb<Types.MediaListResults>(url);

	return validateResponse(response);
}

/** Search TMDB multi endpoint */
export async function getSearchResult(
	query: string,
	page: number,
): Promise<Types.SearchResults> {
	const pagenumber = page ?? 1;
	const url = `/search/multi?language=en-US&query=${encodeURIComponent(query)}&page=${pagenumber}`;
	const response = await tmdb<Types.SearchResults>(url);

	return validateResponse(response);
}

/** Get collection details (requires valid id) */
export async function getCollection({
	id,
}: {
	id: number;
}): Promise<Types.Collection> {
	validateId(id);
	const url = `/collection/${id}?language=en-US&include_adult=true`;
	const response = await tmdb<Types.Collection>(url);

	return validateResponse(response);
}

/** Lightweight movie info (with long cache) */
export async function getBasicMovieDetails({
	id,
}: {
	id: number;
}): Promise<Types.BasicMovie> {
	validateId(id);
	const url = `/movie/${id}?include_adult=true`;
	const response = await tmdb<Types.BasicMovie>(url, {
		revalidate: 1000 * 60 * 60 * 48,
	}); // 48h cache

	return validateResponse(response);
}

/** Heavy movie details with all subfields */
export async function getMovieDetails({
	id,
}: {
	id: number;
}): Promise<Types.Movie> {
	validateId(id);
	const url = `/movie/${id}?include_adult=true&append_to_response=external_ids,images,credits,image,videos,collections,release_dates,keywords`;
	const response = await tmdb<Types.Movie>(url);

	return validateResponse(response);
}

/** Movie recommendations as array */
export async function getMovieRecommendations({
	id,
}: {
	id: number;
}): Promise<Types.MovieRecommendationsResultsEntity[]> {
	validateId(id);
	const url = `/movie/${id}/recommendations?language=en-US`;
	const response = await tmdb<Types.MovieRecommendations>(url);
	const result = validateResponse(response);

	return result.results ?? [];
}

/** TV recommendations as array */
export async function getTvSeriesRecommendations({
	id,
}: {
	id: number;
}): Promise<Types.TvRecommendationsResultsEntity[]> {
	validateId(id);
	const url = `/tv/${id}/recommendations?language=en-US`;
	const response = await tmdb<Types.TvRecommendations>(url);
	const result = validateResponse(response);

	return result.results ?? [];
}

/** Credits for either movie or tv */
export async function getCredits({
	id,
	type,
}: {
	id: number;
	type: "movie" | "tv";
}): Promise<Types.Credits> {
	validateId(id);
	const url = `/${type}/${id}/credits`;
	const response = await tmdb<Types.Credits>(url);

	return validateResponse(response);
}

/** Lightweight TV info (long cache) */
export async function getBasicTvDetails({
	id,
}: {
	id: number;
}): Promise<Types.BasicTv> {
	validateId(id);
	const url = `/tv/${id}?include_adult=true`;
	const response = await tmdb<Types.BasicTv>(url, {
		revalidate: 1000 * 60 * 60 * 48,
	}); // 48h cache

	return validateResponse(response);
}

/** Full TV info (with append_to_response) */
export async function getTvDetails({ id }: { id: number }): Promise<Types.Tv> {
	validateId(id);
	const url = `/tv/${id}?include_adult=true&append_to_response=external_ids,images,credits,image,videos,collections,release_dates,recommendations,keywords,content_ratings`;
	const response = await tmdb<Types.Tv>(url);

	return validateResponse(response);
}

/** Images from movie or tv */
export async function getImages({
	id,
	type,
}: {
	id: number;
	type: "movie" | "tv";
}): Promise<Types.MediaImages> {
	validateId(id);
	const url = `/${type}/${id}/images`;
	const response = await tmdb<Types.MediaImages>(url);

	return validateResponse(response);
}

/** Videos from movie or tv, returns array */
export async function getVideos({
	id,
	type,
}: {
	id: number;
	type: "movie" | "tv";
}): Promise<Types.MediaVideosResultsEntity[]> {
	validateId(id);
	const url = `/${type}/${id}/videos?language=en-US`;
	const response = await tmdb<Types.MediaVideos>(url);
	const result = validateResponse(response);

	return result.results ?? [];
}

/** General recommendations for any media type */
export async function getMediaRecommendations({
	type,
	id,
	page,
}: {
	type: string;
	id: number;
	page: number;
}) {
	validateId(id);
	const url = `/${type}/${id}/recommendations?language=en-US&page=${page}`;
	const response = await tmdb<Types.MediaRecommendations>(url);

	return validateResponse(response);
}

/** TV Season details with episode list */
export async function getTvSeasonDetails({
	tvId,
	seasonNumber,
}: {
	tvId: number;
	seasonNumber: number;
}): Promise<Types.TvSeasonDetail> {
	validateId(tvId);
	const url = `/tv/${tvId}/season/${seasonNumber}?language=en-US`;
	const response = await tmdb<Types.TvSeasonDetail>(url);

	return validateResponse(response);
}
/** Get keyword details */
export async function getKeywordDetails({
	id,
}: {
	id: number;
}): Promise<{ id: number; name: string }> {
	validateId(id);
	const url = `/keyword/${id}`;
	const response = await tmdb<{ id: number; name: string }>(url);
	return validateResponse(response);
}

/** Discover movies by keyword */
export async function getDiscoverMovies({
	with_keywords,
	page,
}: {
	with_keywords: string;
	page: number;
}): Promise<Types.MediaListResults> {
	const pagenumber = page ?? 1;
	const url = `/discover/movie?include_adult=true&include_video=false&language=en-US&page=${pagenumber}&sort_by=popularity.desc&with_keywords=${with_keywords}`;
	const response = await tmdb<Types.MediaListResults>(url);
	return validateResponse(response);
}

/** Discover movies by genre */
export async function getDiscoverMoviesByGenre({
	with_genres,
	page,
}: {
	with_genres: string;
	page: number;
}): Promise<Types.MediaListResults> {
	const pagenumber = page ?? 1;
	// Sort by popularity, include adult
	const url = `/discover/movie?include_adult=true&include_video=false&language=en-US&page=${pagenumber}&sort_by=popularity.desc&with_genres=${with_genres}`;
	const response = await tmdb<Types.MediaListResults>(url);
	return validateResponse(response);
}
