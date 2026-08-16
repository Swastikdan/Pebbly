import { useQuery } from "@tanstack/react-query";
import {
	getBasicMovieDetails,
	getBasicTvDetails,
	getSearchResult,
} from "@/lib/queries";
import type { BasicMovie, BasicTv } from "@/lib/tmdb-schemas";
import type { AIRecommendation } from "@/types";

export interface NormalizedTmdbData {
	id: number;
	title: string;
	posterPath: string | null;
	rating: number;
	releaseDate: string | null;
	overview: string;
}

export function normalizeTmdbData(
	data: BasicMovie | BasicTv | null | undefined,
	mediaType: "movie" | "tv",
): NormalizedTmdbData | null {
	if (!data) return null;
	if (mediaType === "movie") {
		const m = data as BasicMovie;
		return {
			id: m.id,
			title: m.title,
			posterPath: m.poster_path || null,
			rating: m.vote_average,
			releaseDate: m.release_date || null,
			overview: m.overview,
		};
	}
	const t = data as BasicTv;
	return {
		id: t.id,
		title: t.name,
		posterPath: t.poster_path || null,
		rating: t.vote_average,
		releaseDate: t.first_air_date || null,
		overview: t.overview,
	};
}

export function titlesMatch(aiTitle: string, tmdbTitle: string): boolean {
	const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
	const a = normalize(aiTitle);
	const b = normalize(tmdbTitle);
	return a === b || a.includes(b) || b.includes(a);
}

export function normalizeTitleKey(title?: string | null): string {
	return (title ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function useTmdbData(tmdbId: number | null, mediaType: "movie" | "tv") {
	const {
		data: movieData,
		isLoading: movieLoading,
		isError: movieError,
	} = useQuery({
		queryKey: ["basic_movie_details", tmdbId],
		queryFn: () => getBasicMovieDetails({ id: tmdbId as number }),
		enabled: !!tmdbId && mediaType === "movie",
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const {
		data: tvData,
		isLoading: tvLoading,
		isError: tvError,
	} = useQuery({
		queryKey: ["basic_tv_details", tmdbId],
		queryFn: () => getBasicTvDetails({ id: tmdbId as number }),
		enabled: !!tmdbId && mediaType === "tv",
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (!tmdbId) return { data: null, isLoading: false, exists: false };

	const data = mediaType === "movie" ? movieData : tvData;
	const isLoading = mediaType === "movie" ? movieLoading : tvLoading;
	const isError = mediaType === "movie" ? movieError : tvError;

	return {
		data: normalizeTmdbData(data, mediaType),
		isLoading,
		exists: !!data && !isError,
	};
}

export function useTmdbSearchFallback(
	title: string,
	mediaType: "movie" | "tv",
	shouldSearch: boolean,
) {
	const { data: searchData, isLoading: searchLoading } = useQuery({
		queryKey: ["tmdb_search_fallback", title, mediaType],
		queryFn: async () => {
			const results = await getSearchResult({ query: title, page: 1 });
			const filtered = (results.results ?? []).filter(
				(r) => r.media_type === mediaType,
			);
			if (filtered.length === 0) return null;
			const first = filtered[0];
			const resultTitle =
				mediaType === "movie"
					? (first.title ?? first.name ?? "")
					: (first.name ?? first.title ?? "");

			if (!titlesMatch(title, resultTitle)) return null;

			const rating = first.vote_average ?? 0;
			if (rating === 0 || !first.poster_path || !resultTitle) return null;

			return {
				id: first.id,
				title: resultTitle,
				posterPath: first.poster_path ?? null,
				rating,
				releaseDate:
					mediaType === "movie"
						? (first.release_date ?? null)
						: (first.first_air_date ?? null),
				overview: first.overview ?? "",
			} as NormalizedTmdbData;
		},
		enabled: shouldSearch,
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	return {
		data: searchData ?? null,
		isLoading: searchLoading && shouldSearch,
		exists: !!searchData,
	};
}

export type { AIRecommendation };
