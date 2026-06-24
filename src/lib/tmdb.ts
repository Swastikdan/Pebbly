import { cache } from "react";

const ACCESS_TOKEN = import.meta.env.VITE_PUBLIC_TMDB_ACCESS_TOKEN;
const BASE_URL = import.meta.env.VITE_PUBLIC_TMDB_API_URL;

if (ACCESS_TOKEN === undefined || BASE_URL === undefined) {
	throw new Error("Missing TMDB env variables");
}
interface TmdbApiResult<T> {
	data?: T;
	error?: string;
}
const tmdbApi = async <T>(endpoint: string): Promise<TmdbApiResult<T>> => {
	const normalizedEndpoint = endpoint.startsWith("/")
		? endpoint
		: `/${endpoint}`;
	const fetchUrl = `${BASE_URL}${normalizedEndpoint}`;

	const requestOptions: RequestInit = {
		method: "GET",
		headers: {
			accept: "application/json",
			Authorization: `Bearer ${ACCESS_TOKEN}`,
		},
		signal: AbortSignal.timeout(15_000),
		cache: "default" as RequestCache,
	};

	try {
		const response = await fetch(fetchUrl, requestOptions);

		if (!response.ok) {
			const errorMessage = `TMDB API error: ${response.status} ${response.statusText}`;
			console.error(errorMessage, { endpoint: normalizedEndpoint });
			return { error: errorMessage };
		}

		const data = (await response.json()) as T;
		return { data };
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? `Network error: ${error.message}`
				: `Unknown error: ${String(error)}`;
		console.error("TMDB API fetch failed:", errorMessage, {
			endpoint: normalizedEndpoint,
		});
		return { error: errorMessage };
	}
};

export const tmdb = cache(tmdbApi);
