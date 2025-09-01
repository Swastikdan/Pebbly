import { cache } from "react";

import { env } from "@/env";

/* --- Constants --- */
const ACCESS_TOKEN = env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
const BASE_URL = env.NEXT_PUBLIC_TMDB_API_URL;
const DEFAULT_REVALIDATE_TIME = 3600; // 1 hour in seconds

/* --- Types --- */
interface TmdbApiResult<T> {
  data?: T;
  error?: string;
}

interface TmdbOptions {
  revalidate?: number;
  tags?: string[];
}

/* --- API Utility --- */
export const tmdbApi = cache(async function fetchTmdbData<T>(
  endpoint: string,
  options: TmdbOptions = {},
): Promise<TmdbApiResult<T>> {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const fetchUrl = `${BASE_URL}${normalizedEndpoint}`;

  // eslint-disable-next-line no-undef
  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    next: {
      revalidate: options.revalidate ?? DEFAULT_REVALIDATE_TIME,
      tags: ["tmdb", ...(options.tags || []), normalizedEndpoint],
    },
    cache: "force-cache",
  };

  try {
    const response = await fetch(fetchUrl, requestOptions);

    if (!response.ok) {
      const errorMessage = `TMDB API error: ${response.status} ${response.statusText}`;

      // eslint-disable-next-line no-console
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

    // eslint-disable-next-line no-console
    console.error("TMDB API fetch failed:", errorMessage, {
      endpoint: normalizedEndpoint,
    });

    return { error: errorMessage };
  }
});

/* --- Convenience Functions --- */

/** Fetch data with no cache (revalidate = 0) */
export const tmdbApiNoCache = async <T>(
  endpoint: string,
  tags?: string[],
): Promise<TmdbApiResult<T>> => {
  return tmdbApi<T>(endpoint, { revalidate: 0, tags });
};

/** Fetch data with long cache (24 hours) */
export const tmdbApiLongCache = async <T>(
  endpoint: string,
  tags?: string[],
): Promise<TmdbApiResult<T>> => {
  return tmdbApi<T>(endpoint, { revalidate: 86400, tags }); // 24 hours
};

/* --- Legacy Export (for backward compatibility) --- */
export const Tmdb = tmdbApi;
