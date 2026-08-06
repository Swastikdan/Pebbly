import { cache } from "react";
import type * as Types from "@/types";
import { tmdbFetch } from "./tmdb";
import * as Schemas from "./tmdb-schemas";
import { validateId } from "./utils";

/*
 * Safe fetch helper with dev logging for URL, endpoint, and schema validation issues
 */
async function safeFetch<T>(
	queryName: string,
	url: string,
	schema: any,
): Promise<T> {
	try {
		return await tmdbFetch(url, { output: schema });
	} catch (error: any) {
		if (import.meta.env.DEV) {
			console.error(`[${queryName}] ❌ Error fetching TMDB URL: "${url}"`, {
				queryName,
				url,
				fullUrl: `${import.meta.env.VITE_PUBLIC_TMDB_API_URL}${url}`,
				errorMessage: error?.message,
				validationIssues: error?.issues || error?.cause?.issues || null,
				error,
			});
		}
		throw error;
	}
}

/*
 * TMDB Query Functions
 */

export const getMedia = cache(
	async ({
		type,
		page,
	}: Types.MediaQuery): Promise<Types.MediaListResultsEntity[]> => {
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
	},
);

export const getMediaList = cache(
	async ({
		type,
		page,
	}: Types.MediaListQuery): Promise<Types.MediaListResults> => {
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
	},
);

export const getSearchResult = cache(
	async (
		arg1: string | { query: string; page?: number },
		arg2?: number,
	): Promise<Types.SearchResults> => {
		const queryStr = typeof arg1 === "string" ? arg1 : arg1.query;
		const pageNumber =
			typeof arg1 === "string" ? (arg2 ?? 1) : (arg1.page ?? 1);
		const url = `/search/multi?query=${encodeURIComponent(queryStr)}&include_adult=false&language=en-US&page=${pageNumber}`;

		return await safeFetch<Types.SearchResults>(
			"getSearchResult",
			url,
			Schemas.SearchResultsSchema,
		);
	},
);

export const getCollection = cache(
	async ({ id }: { id: number }): Promise<Types.Collection> => {
		validateId(id);
		const url = `/collection/${id}?language=en-US`;

		return await safeFetch<Types.Collection>(
			"getCollection",
			url,
			Schemas.CollectionSchema,
		);
	},
);

export const getMovieDetails = cache(
	async ({ id }: { id: number }): Promise<Types.Movie> => {
		validateId(id);
		const url = `/movie/${id}?language=en-US&append_to_response=images,videos,credits,release_dates,external_ids,keywords`;

		return await safeFetch<Types.Movie>(
			"getMovieDetails",
			url,
			Schemas.MovieSchema,
		);
	},
);

export const getBasicMovieDetails = cache(
	async ({ id }: { id: number }): Promise<Types.BasicMovie> => {
		validateId(id);
		const url = `/movie/${id}?language=en-US`;

		return await safeFetch<Types.BasicMovie>(
			"getBasicMovieDetails",
			url,
			Schemas.BasicMovieSchema,
		);
	},
);

export const getMovieRecommendations = cache(
	async (
		arg1: number | { id: number; page?: number },
		arg2?: number,
	): Promise<Types.MovieRecommendations> => {
		const targetId = typeof arg1 === "number" ? arg1 : arg1.id;
		const pageNumber =
			typeof arg1 === "number" ? (arg2 ?? 1) : (arg1.page ?? 1);
		validateId(targetId);
		const url = `/movie/${targetId}/recommendations?language=en-US&page=${pageNumber}`;

		return await safeFetch<Types.MovieRecommendations>(
			"getMovieRecommendations",
			url,
			Schemas.MovieRecommendationsSchema,
		);
	},
);

export const getTvDetails = cache(
	async ({ id }: { id: number }): Promise<Types.Tv> => {
		validateId(id);
		const url = `/tv/${id}?language=en-US&append_to_response=images,videos,credits,external_ids,recommendations,keywords,content_ratings`;

		return await safeFetch<Types.Tv>("getTvDetails", url, Schemas.TvSchema);
	},
);

export const getBasicTvDetails = cache(
	async ({ id }: { id: number }): Promise<Types.BasicTv> => {
		validateId(id);
		const url = `/tv/${id}?language=en-US`;

		return await safeFetch<Types.BasicTv>(
			"getBasicTvDetails",
			url,
			Schemas.BasicTvSchema,
		);
	},
);

export const getTvRecommendations = cache(
	async (
		arg1: number | { id: number; page?: number },
		arg2?: number,
	): Promise<Types.TvRecommendations> => {
		const targetId = typeof arg1 === "number" ? arg1 : arg1.id;
		const pageNumber =
			typeof arg1 === "number" ? (arg2 ?? 1) : (arg1.page ?? 1);
		validateId(targetId);
		const url = `/tv/${targetId}/recommendations?language=en-US&page=${pageNumber}`;

		return await safeFetch<Types.TvRecommendations>(
			"getTvRecommendations",
			url,
			Schemas.TvRecommendationsSchema,
		);
	},
);

export const getTvSeriesRecommendations = getTvRecommendations;

export const getCredits = cache(
	async ({
		type,
		id,
	}: {
		type: string;
		id: number;
	}): Promise<Types.Credits> => {
		validateId(id);
		const url = `/${type}/${id}/credits?language=en-US`;

		return await safeFetch<Types.Credits>(
			"getCredits",
			url,
			Schemas.CreditsSchema,
		);
	},
);

export const getVideos = cache(
	async ({
		type,
		id,
	}: {
		type: string;
		id: number;
	}): Promise<Types.MediaVideos> => {
		validateId(id);
		const url = `/${type}/${id}/videos?language=en-US`;

		return await safeFetch<Types.MediaVideos>(
			"getVideos",
			url,
			Schemas.MediaVideosSchema,
		);
	},
);

export const getImages = cache(
	async ({
		type,
		id,
	}: {
		type: string;
		id: number;
	}): Promise<Types.MediaImages> => {
		validateId(id);
		const url = `/${type}/${id}/images`;

		return await safeFetch<Types.MediaImages>(
			"getImages",
			url,
			Schemas.MediaImagesSchema,
		);
	},
);

export const getDiscoverMovies = cache(
	async (
		arg1: number | { with_keywords: number | string; page?: number },
		arg2?: number,
	): Promise<Types.SearchResults> => {
		let keywordId = 0;
		let pageNumber = 1;

		if (typeof arg1 === "number") {
			keywordId = arg1;
			pageNumber = arg2 ?? 1;
		} else {
			keywordId =
				typeof arg1.with_keywords === "string"
					? parseInt(arg1.with_keywords, 10)
					: arg1.with_keywords;
			pageNumber = arg1.page ?? 1;
		}

		const url = `/discover/movie?with_keywords=${keywordId}&language=en-US&page=${pageNumber}`;

		return await safeFetch<Types.SearchResults>(
			"getDiscoverMovies",
			url,
			Schemas.SearchResultsSchema,
		);
	},
);

export const getTvSeasonDetails = cache(
	async ({
		id,
		tvId,
		seasonNumber,
	}: {
		id?: number;
		tvId?: number;
		seasonNumber: number;
	}): Promise<Types.TvSeasonDetail> => {
		const targetId = id ?? tvId ?? 0;
		validateId(targetId);
		const url = `/tv/${targetId}/season/${seasonNumber}?language=en-US`;

		return await safeFetch<Types.TvSeasonDetail>(
			"getTvSeasonDetails",
			url,
			Schemas.TvSeasonDetailSchema,
		);
	},
);

export const getTvEpisodeDetails = cache(
	async ({
		id,
		tvId,
		seasonNumber,
		episodeNumber,
	}: {
		id?: number;
		tvId?: number;
		seasonNumber: number;
		episodeNumber: number;
	}): Promise<Types.TvEpisodeDetail> => {
		const targetId = id ?? tvId ?? 0;
		validateId(targetId);
		const url = `/tv/${targetId}/season/${seasonNumber}/episode/${episodeNumber}?language=en-US`;

		return await safeFetch<Types.TvEpisodeDetail>(
			"getTvEpisodeDetails",
			url,
			Schemas.TvEpisodeDetailSchema,
		);
	},
);

export const getMediaRecommendations = cache(
	async ({
		type,
		id,
		page,
	}: {
		type: string;
		id: number;
		page?: number;
	}): Promise<Types.MediaRecommendations> => {
		validateId(id);
		const pageNumber = page ?? 1;
		const url = `/${type}/${id}/recommendations?language=en-US&page=${pageNumber}`;

		return await safeFetch<Types.MediaRecommendations>(
			"getMediaRecommendations",
			url,
			Schemas.MediaRecommendationsSchema,
		);
	},
);

export const getPersonDetails = cache(
	async ({ id }: { id: number }): Promise<Types.PersonDetails> => {
		validateId(id);
		const url = `/person/${id}?language=en-US&append_to_response=movie_credits,tv_credits,images,external_ids`;

		return await safeFetch<Types.PersonDetails>(
			"getPersonDetails",
			url,
			Schemas.PersonDetailsSchema,
		);
	},
);

export const getKeywordDetails = cache(
	async ({ id }: { id: number }): Promise<{ id: number; name: string }> => {
		validateId(id);
		const url = `/keyword/${id}`;

		return await safeFetch<{ id: number; name: string }>(
			"getKeywordDetails",
			url,
			Schemas.KeywordResultSchema,
		);
	},
);
