import { createFetch } from "@better-fetch/fetch";

/**
 * Lazily built TMDB client. Importing this module must never throw (tests and
 * server bundles import transitively without TMDB env vars); the missing-env
 * error surfaces on first actual use instead.
 */
let client: ReturnType<typeof createFetch> | null = null;

const isWorker =
  typeof window === "undefined" &&
  (typeof (globalThis as unknown as { __env__?: unknown }).__env__ !==
    "undefined" ||
    (typeof navigator !== "undefined" &&
      navigator.userAgent === "Cloudflare-Workers"));

const tmdbCustomFetch = (
  input: string | URL | Request,
  init?: RequestInit & { cf?: Record<string, unknown> },
) => {
  if (isWorker) {
    return (
      fetch as (
        input: string | URL | Request,
        init?: unknown,
      ) => Promise<Response>
    )(input, {
      ...init,
      cf: {
        cacheTtl: 3600,
        cacheEverything: true,
        ...init?.cf,
      },
    });
  }
  return fetch(input, init);
};

export function getTmdbFetch() {
  if (!client) {
    const ACCESS_TOKEN = import.meta.env.VITE_PUBLIC_TMDB_ACCESS_TOKEN;
    const BASE_URL = import.meta.env.VITE_PUBLIC_TMDB_API_URL;

    if (!ACCESS_TOKEN || !BASE_URL) {
      throw new Error("Missing TMDB environment variables");
    }

    client = createFetch({
      baseURL: BASE_URL,
      customFetchImpl: tmdbCustomFetch,
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
