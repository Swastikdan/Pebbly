import type { MediaListQuery, MediaQuery } from "@/types";
import { getTmdbFetch } from "./tmdb";
import type {
	BasicMovie,
	BasicTv,
	Collection,
	Credits,
	MediaImages,
	MediaListResults,
	MediaListResultsEntity,
	MediaRecommendations,
	MediaVideos,
	Movie,
	MovieRecommendations,
	PersonDetails,
	SearchResults,
	Tv,
	TvEpisodeDetail,
	TvRecommendations,
	TvSeasonDetail,
} from "./tmdb-schemas";
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

/*
 * TMDB Query Functions
 */

type MediaListType = MediaQuery["type"] | MediaListQuery["type"];

/** Endpoint path for each media-list query type. */
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

/**
 * Fetch one page of a media list (popular, top-rated, trending, ...).
 * Replaces the old getMedia/getMediaList switch duplicates: the type -> path
 * mapping above is the single source of truth for these endpoints.
 */
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

/** Convenience wrapper returning only the results array. */
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

export async function getCollection({
	id,
}: {
	id: number;
}): Promise<Collection> {
	validateId(id);
	const url = `/collection/${id}?language=en-US`;

	return await safeFetch<Collection>(
		"getCollection",
		url,
		Schemas.CollectionSchema,
	);
}

export async function getMovieDetails({ id }: { id: number }): Promise<Movie> {
	validateId(id);
	const url = `/movie/${id}?language=en-US&append_to_response=images,videos,credits,release_dates,external_ids,keywords`;

	return await safeFetch<Movie>("getMovieDetails", url, Schemas.MovieSchema);
}

export async function getBasicMovieDetails({
	id,
}: {
	id: number;
}): Promise<BasicMovie> {
	validateId(id);
	const url = `/movie/${id}?language=en-US`;

	return await safeFetch<BasicMovie>(
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
}): Promise<MovieRecommendations> {
	validateId(id);
	const pageNumber = page ?? 1;
	const url = `/movie/${id}/recommendations?language=en-US&page=${pageNumber}`;

	return await safeFetch<MovieRecommendations>(
		"getMovieRecommendations",
		url,
		Schemas.MovieRecommendationsSchema,
	);
}

export async function getTvDetails({ id }: { id: number }): Promise<Tv> {
	validateId(id);
	// `recommendations` is deliberately NOT appended: the media pages fetch it
	// separately via getTvRecommendations, and TMDB returns a full 20-item
	// result set per title, dropping it shaves ~20 objects off every detail
	// payload that is otherwise cached client-side.
	const url = `/tv/${id}?language=en-US&append_to_response=images,videos,credits,external_ids,keywords,content_ratings`;

	return await safeFetch<Tv>("getTvDetails", url, Schemas.TvSchema);
}

export async function getBasicTvDetails({
	id,
}: {
	id: number;
}): Promise<BasicTv> {
	validateId(id);
	const url = `/tv/${id}?language=en-US`;

	return await safeFetch<BasicTv>(
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
}): Promise<TvRecommendations> {
	validateId(id);
	const pageNumber = page ?? 1;
	const url = `/tv/${id}/recommendations?language=en-US&page=${pageNumber}`;

	return await safeFetch<TvRecommendations>(
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
}): Promise<Credits> {
	validateId(id);
	const url = `/${type}/${id}/credits?language=en-US`;

	return await safeFetch<Credits>("getCredits", url, Schemas.CreditsSchema);
}

export async function getVideos({
	type,
	id,
}: {
	type: "movie" | "tv";
	id: number;
}): Promise<MediaVideos> {
	validateId(id);
	const url = `/${type}/${id}/videos?language=en-US`;

	return await safeFetch<MediaVideos>(
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
}): Promise<MediaImages> {
	validateId(id);
	const url = `/${type}/${id}/images`;

	return await safeFetch<MediaImages>(
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
}): Promise<TvEpisodeDetail> {
	const targetId = id ?? tvId ?? 0;
	validateId(targetId);
	const url = `/tv/${targetId}/season/${seasonNumber}/episode/${episodeNumber}?language=en-US`;

	return await safeFetch<TvEpisodeDetail>(
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
}): Promise<MediaRecommendations> {
	validateId(id);
	const pageNumber = page ?? 1;
	const url = `/${type}/${id}/recommendations?language=en-US&page=${pageNumber}`;

	return await safeFetch<MediaRecommendations>(
		"getMediaRecommendations",
		url,
		Schemas.MediaRecommendationsSchema,
	);
}

export async function getPersonDetails({
	id,
}: {
	id: number;
}): Promise<PersonDetails> {
	validateId(id);
	// The person page only renders movie_credits + tv_credits (and external
	// links). combined_credits is a third copy of the same cast/crew data and
	// images is unused, so both are omitted to shrink a payload that can hold
	// hundreds of credits for prolific actors.
	const url = `/person/${id}?language=en-US&append_to_response=movie_credits,tv_credits,external_ids`;

	return await safeFetch<PersonDetails>(
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
