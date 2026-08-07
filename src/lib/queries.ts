import type * as Types from "@/types";
import { tmdbFetch } from "./tmdb";
import * as Schemas from "./tmdb-schemas";
import { validateId } from "./utils";

/*
 * Safe fetch helper with dev logging for URL, endpoint, and schema validation issues
 */
async function safeFetch<Output>(
	queryName: string,
	url: string,
	schema: unknown,
): Promise<Output> {
	try {
		return (await (
			tmdbFetch as (url: string, opts: unknown) => Promise<Output>
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

/*
 * TMDB Query Functions
 */

export async function getMedia({
	type,
	page,
}: Types.MediaQuery): Promise<Types.MediaListResultsEntity[]> {
	const pageNumber = page ?? 1;
	let url = "";

	switch (type) {
		case "movies_popular":
			url = `/movie/popular?language=en-US&page=${pageNumber}`;
			break;
		case "movies_top-rated":
			url = `/movie/top_rated?language=en-US&page=${pageNumber}`;
			break;
		case "movies_upcoming":
			url = `/movie/upcoming?language=en-US&page=${pageNumber}`;
			break;
		case "tv-shows_popular":
			url = `/tv/popular?language=en-US&page=${pageNumber}`;
			break;
		case "tv-shows_top-rated":
			url = `/tv/top_rated?language=en-US&page=${pageNumber}`;
			break;
		case "trending_day":
			url = `/trending/all/day?language=en-US&page=${pageNumber}`;
			break;
		case "trending_week":
			url = `/trending/all/week?language=en-US&page=${pageNumber}`;
			break;
		default:
			throw new Error(`Unknown media type: ${type}`);
	}

	const data = await safeFetch<Types.MediaListResults>(
		"getMedia",
		url,
		Schemas.MediaListResultsSchema,
	);

	return data.results ?? [];
}

export async function getMediaList({
	type,
	page,
}: Types.MediaListQuery): Promise<Types.MediaListResults> {
	const pageNumber = page ?? 1;
	let url = "";

	switch (type) {
		case "movies_popular":
			url = `/movie/popular?language=en-US&page=${pageNumber}`;
			break;
		case "movies_now-playing":
			url = `/movie/now_playing?language=en-US&page=${pageNumber}`;
			break;
		case "movies_top-rated":
			url = `/movie/top_rated?language=en-US&page=${pageNumber}`;
			break;
		case "movies_upcoming":
			url = `/movie/upcoming?language=en-US&page=${pageNumber}`;
			break;
		case "tv-shows_airing-today":
			url = `/tv/airing_today?language=en-US&page=${pageNumber}`;
			break;
		case "tv-shows_on-the-air":
			url = `/tv/on_the_air?language=en-US&page=${pageNumber}`;
			break;
		case "tv-shows_popular":
			url = `/tv/popular?language=en-US&page=${pageNumber}`;
			break;
		case "tv-shows_top-rated":
			url = `/tv/top_rated?language=en-US&page=${pageNumber}`;
			break;
		default:
			throw new Error(`Unknown media list type: ${type}`);
	}

	return await safeFetch<Types.MediaListResults>(
		"getMediaList",
		url,
		Schemas.MediaListResultsSchema,
	);
}

export async function getSearchResult({
	query,
	page,
}: {
	query: string;
	page?: number;
}): Promise<Types.SearchResults> {
	const pageNumber = page ?? 1;
	const url = `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=${pageNumber}`;

	return await safeFetch<Types.SearchResults>(
		"getSearchResult",
		url,
		Schemas.SearchResultsSchema,
	);
}

export async function getCollection({
	id,
}: {
	id: number;
}): Promise<Types.Collection> {
	validateId(id);
	const url = `/collection/${id}?language=en-US`;

	return await safeFetch<Types.Collection>(
		"getCollection",
		url,
		Schemas.CollectionSchema,
	);
}

export async function getMovieDetails({
	id,
}: {
	id: number;
}): Promise<Types.Movie> {
	validateId(id);
	const url = `/movie/${id}?language=en-US&append_to_response=images,videos,credits,release_dates,external_ids,keywords`;

	return await safeFetch<Types.Movie>(
		"getMovieDetails",
		url,
		Schemas.MovieSchema,
	);
}

export async function getBasicMovieDetails({
	id,
}: {
	id: number;
}): Promise<Types.BasicMovie> {
	validateId(id);
	const url = `/movie/${id}?language=en-US`;

	return await safeFetch<Types.BasicMovie>(
		"getBasicMovieDetails",
		url,
		Schemas.BasicMovieSchema,
	);
}

export async function getMovieRecommendations({
	id,
	page,
}: {
	id: number;
	page?: number;
}): Promise<Types.MovieRecommendations> {
	validateId(id);
	const pageNumber = page ?? 1;
	const url = `/movie/${id}/recommendations?language=en-US&page=${pageNumber}`;

	return await safeFetch<Types.MovieRecommendations>(
		"getMovieRecommendations",
		url,
		Schemas.MovieRecommendationsSchema,
	);
}

export async function getTvDetails({ id }: { id: number }): Promise<Types.Tv> {
	validateId(id);
	const url = `/tv/${id}?language=en-US&append_to_response=images,videos,credits,external_ids,recommendations,keywords,content_ratings`;

	return await safeFetch<Types.Tv>("getTvDetails", url, Schemas.TvSchema);
}

export async function getBasicTvDetails({
	id,
}: {
	id: number;
}): Promise<Types.BasicTv> {
	validateId(id);
	const url = `/tv/${id}?language=en-US`;

	return await safeFetch<Types.BasicTv>(
		"getBasicTvDetails",
		url,
		Schemas.BasicTvSchema,
	);
}

export async function getTvRecommendations({
	id,
	page,
}: {
	id: number;
	page?: number;
}): Promise<Types.TvRecommendations> {
	validateId(id);
	const pageNumber = page ?? 1;
	const url = `/tv/${id}/recommendations?language=en-US&page=${pageNumber}`;

	return await safeFetch<Types.TvRecommendations>(
		"getTvRecommendations",
		url,
		Schemas.TvRecommendationsSchema,
	);
}

export const getTvSeriesRecommendations = getTvRecommendations;

export async function getCredits({
	type,
	id,
}: {
	type: "movie" | "tv";
	id: number;
}): Promise<Types.Credits> {
	validateId(id);
	const url = `/${type}/${id}/credits?language=en-US`;

	return await safeFetch<Types.Credits>(
		"getCredits",
		url,
		Schemas.CreditsSchema,
	);
}

export async function getVideos({
	type,
	id,
}: {
	type: "movie" | "tv";
	id: number;
}): Promise<Types.MediaVideos> {
	validateId(id);
	const url = `/${type}/${id}/videos?language=en-US`;

	return await safeFetch<Types.MediaVideos>(
		"getVideos",
		url,
		Schemas.MediaVideosSchema,
	);
}

export async function getImages({
	type,
	id,
}: {
	type: "movie" | "tv";
	id: number;
}): Promise<Types.MediaImages> {
	validateId(id);
	const url = `/${type}/${id}/images`;

	return await safeFetch<Types.MediaImages>(
		"getImages",
		url,
		Schemas.MediaImagesSchema,
	);
}

export async function getDiscoverMovies({
	with_keywords,
	page,
}: {
	with_keywords: number;
	page?: number;
}): Promise<Types.SearchResults> {
	const pageNumber = page ?? 1;
	const url = `/discover/movie?with_keywords=${with_keywords}&language=en-US&page=${pageNumber}`;

	return await safeFetch<Types.SearchResults>(
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
}): Promise<Types.TvSeasonDetail> {
	const targetId = id ?? tvId ?? 0;
	validateId(targetId);
	const url = `/tv/${targetId}/season/${seasonNumber}?language=en-US`;

	return await safeFetch<Types.TvSeasonDetail>(
		"getTvSeasonDetails",
		url,
		Schemas.TvSeasonDetailSchema,
	);
}

export async function getTvEpisodeDetails({
	id,
	tvId,
	seasonNumber,
	episodeNumber,
}: {
	id?: number;
	tvId?: number;
	seasonNumber: number;
	episodeNumber: number;
}): Promise<Types.TvEpisodeDetail> {
	const targetId = id ?? tvId ?? 0;
	validateId(targetId);
	const url = `/tv/${targetId}/season/${seasonNumber}/episode/${episodeNumber}?language=en-US`;

	return await safeFetch<Types.TvEpisodeDetail>(
		"getTvEpisodeDetails",
		url,
		Schemas.TvEpisodeDetailSchema,
	);
}

export async function getMediaRecommendations({
	type,
	id,
	page,
}: {
	type: "movie" | "tv";
	id: number;
	page?: number;
}): Promise<Types.MediaRecommendations> {
	validateId(id);
	const pageNumber = page ?? 1;
	const url = `/${type}/${id}/recommendations?language=en-US&page=${pageNumber}`;

	return await safeFetch<Types.MediaRecommendations>(
		"getMediaRecommendations",
		url,
		Schemas.MediaRecommendationsSchema,
	);
}

export async function getPersonDetails({
	id,
}: {
	id: number;
}): Promise<Types.PersonDetails> {
	validateId(id);
	const url = `/person/${id}?language=en-US&append_to_response=combined_credits,movie_credits,tv_credits,images,external_ids`;

	return await safeFetch<Types.PersonDetails>(
		"getPersonDetails",
		url,
		Schemas.PersonDetailsSchema,
	);
}

export async function getKeywordDetails({
	id,
}: {
	id: number;
}): Promise<{ id: number; name: string }> {
	validateId(id);
	const url = `/keyword/${id}`;

	return await safeFetch<{ id: number; name: string }>(
		"getKeywordDetails",
		url,
		Schemas.KeywordResultSchema,
	);
}
