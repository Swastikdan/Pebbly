import { createFetch } from "@better-fetch/fetch";

// import { logger } from "@better-fetch/logger";

/**
 * Lazily built TMDB client. Importing this module must never throw (tests and
 * server bundles import transitively without TMDB env vars); the missing-env
 * error surfaces on first actual use instead.
 */
let client: ReturnType<typeof createFetch> | null = null;

export function getTmdbFetch() {
  if (!client) {
    const ACCESS_TOKEN = import.meta.env.VITE_PUBLIC_TMDB_ACCESS_TOKEN;
    const BASE_URL = import.meta.env.VITE_PUBLIC_TMDB_API_URL;

    if (!ACCESS_TOKEN || !BASE_URL) {
      throw new Error("Missing TMDB environment variables");
    }

    client = createFetch({
      baseURL: BASE_URL,
      throw: true,
      timeout: 15_000,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      retry: {
        type: "linear",
        attempts: 2,
        delay: 500,
        shouldRetry(response: Response | null) {
          if (!response) return true;
          const status = response.status;
          return status === 408 || status === 429 || status >= 500;
        },
      },
    });
  }
  return client;
}
