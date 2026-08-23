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

/**
 * Shared loader/head ceremony for detail-style routes: id validation,
 * awaited details hydration (so SSR og:image sees real data), slug titles,
 * and meta-tag construction.
 */

/** Minimal shape needed to extract an og:image poster path. */
type PosterBearing = { poster_path?: string | null };

export type MediaKind = "movie" | "tv";

/** "full" = append_to_response detail payload (index pages); "basic" = lean payload (subpages). */
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

/** Parse a route `$id` param, throwing the route's 404 when malformed. */
export function requireRouteId(raw: string): number {
  const parsed = parseAndValidateId(raw);
  if (!parsed.success) {
    throw notFound();
  }
  return parsed.data;
}

/** Slug segment -> display title, falling back when the slug is absent. */
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
  /** Title when the URL carries no slug (e.g. "Movie Page"). */
  titleFallback?: string;
};

export type MediaRouteData = {
  id: string;
  slug?: string;
  title: string;
  posterPath: string | null;
};

/** Loader body for movie/tv detail routes: validate id, hydrate, build head data. */
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

/** Meta array for detail pages, deriving og:image from the hydrated poster. */
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
