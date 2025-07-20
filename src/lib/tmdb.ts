import { cache } from "react";
import { env } from "@/env";

const accessToken = env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
const baseUrl = env.NEXT_PUBLIC_TMDB_API_URL;
const method = "GET";

interface FetchTmdbDataResult<T> {
  data?: T;
  error?: string;
}

export const Tmdb = cache(async function UncachedTmdb<T>(
  url: string,
  customCacheTime?: number,
): Promise<FetchTmdbDataResult<T>> {
  const fetchUrl = `${baseUrl}${url}`;

  const options: RequestInit = {
    method,
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    next: {
      revalidate: customCacheTime ?? 0,
      tags: ["tmdb", url],
    },

    cache: "force-cache",
  };

  try {
    const response = await fetch(fetchUrl, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as T;
    return { data };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    throw new Error("Unknown error: " + String(error));
  }
});
