import { notFound } from "@tanstack/react-router";

import type { QueryClient } from "@tanstack/react-query";
import { IMAGE_PREFIX } from "@/constants";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import {
  getBasicMovieDetails,
  getBasicTvDetails,
  getMovieDetails,
  getTvDetails,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { formatMediaTitle, parseAndValidateId } from "@/lib/utils";

type PosterBearing = { poster_path?: string | null };

export type MediaKind = "movie" | "tv";

export type DetailLevel = "full" | "basic";

type MediaDetailQuery = {
  key: (id: number) => readonly unknown[];
  fetcher: (args: { id: number }) => Promise<PosterBearing>;
};

const MEDIA_DETAIL_QUERIES: Record<
  MediaKind,
  Record<DetailLevel, MediaDetailQuery>
> = {
  movie: {
    full: {
      key: queryKeys.tmdb.movieDetails,
      fetcher: getMovieDetails,
    },
    basic: {
      key: queryKeys.tmdb.basicMovieDetails,
      fetcher: getBasicMovieDetails,
    },
  },
  tv: {
    full: { key: queryKeys.tmdb.tvDetails, fetcher: getTvDetails },
    basic: { key: queryKeys.tmdb.basicTvDetails, fetcher: getBasicTvDetails },
  },
};

export function requireRouteId(raw: string): number {
  const parsed = parseAndValidateId(raw);
  if (!parsed.success) {
    throw notFound();
  }
  return parsed.data;
}

export function slugTitle(slug: string | undefined, fallback = ""): string {
  return slug ? formatMediaTitle.decode(slug) : fallback;
}

/**
 * Await the details query so the cache is populated before the loader
 * resolves (SSR head tags render real poster paths, never cold-cache nulls).
 */
export async function ensureMediaDetails(
  context: { queryClient: QueryClient },
  options: { mediaType: MediaKind; id: number; level?: DetailLevel },
): Promise<PosterBearing> {
  const { key, fetcher } =
    MEDIA_DETAIL_QUERIES[options.mediaType][options.level ?? "basic"];
  return await context.queryClient.ensureQueryData({
    queryKey: key(options.id),
    queryFn: () => fetcher({ id: options.id }),
  });
}

export type MediaRouteOptions = {
  mediaType: MediaKind;
  level?: DetailLevel;
  titleFallback?: string;
};

export type MediaRouteData = {
  id: string;
  slug?: string;
  title: string;
  posterPath: string | null;
};

export function loadMediaRouteData(
  context: { queryClient: QueryClient },
  params: { id: string; slug?: string },
  options: MediaRouteOptions,
): Promise<MediaRouteData> {
  const numericId = requireRouteId(params.id);
  return ensureMediaDetails(context, {
    mediaType: options.mediaType,
    id: numericId,
    level: options.level,
  }).then((data) => ({
    id: params.id,
    slug: params.slug,
    title: slugTitle(params.slug, options.titleFallback),
    posterPath: data.poster_path ?? null,
  }));
}

export function detailHead(input: {
  title: string;
  description: string;
  posterPath?: string | null;
  url?: string;
}): ReturnType<typeof MetaImageTagsGenerator> {
  return [
    ...MetaImageTagsGenerator({
      title: input.title,
      description: input.description,
      ogImage: input.posterPath
        ? `${IMAGE_PREFIX.SD_POSTER}${input.posterPath}`
        : undefined,
      url: input.url,
    }),
  ];
}
