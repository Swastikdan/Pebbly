import { notFound } from "@tanstack/react-router";

import type { QueryClient } from "@tanstack/react-query";
import { IMAGE_PREFIX } from "@/constants";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import {
  getBasicMovieDetails,
  getBasicTvDetails,
  getMovieDetails,
  getTvDetails,
  getWatchProviders,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { formatMediaTitle, parseAndValidateId } from "@/lib/utils";
import { getEdgeRegion } from "@/server/fns/region";
import { unwrap } from "@/server/schema/common";

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

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status =
    ("status" in error && typeof error.status === "number"
      ? error.status
      : undefined) ??
    ("statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : undefined) ??
    ("response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "status" in error.response &&
    typeof error.response.status === "number"
      ? error.response.status
      : undefined);
  return status === 404;
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
  try {
    return await context.queryClient.ensureQueryData({
      queryKey: key(options.id),
      queryFn: () => fetcher({ id: options.id }),
    });
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      throw notFound();
    }
    // Return empty fallback so network errors or upstream timeouts
    // don't crash SSR into a 500 error; the component will render its
    // error state instead.
    return { poster_path: null };
  }
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
  region?: string;
};

export async function loadMediaRouteData(
  context: { queryClient: QueryClient },
  params: { id: string; slug?: string },
  options: MediaRouteOptions,
): Promise<MediaRouteData> {
  const numericId = requireRouteId(params.id);
  const isFull = options.level === "full";

  const [data, region] = await Promise.all([
    ensureMediaDetails(context, {
      mediaType: options.mediaType,
      id: numericId,
      level: options.level,
    }),
    isFull
      ? unwrap(getEdgeRegion()).catch(() => "US")
      : Promise.resolve(undefined),
    isFull
      ? context.queryClient
          .ensureQueryData({
            queryKey: queryKeys.tmdb.watchProviders(
              numericId,
              options.mediaType,
            ),
            queryFn: () =>
              getWatchProviders({ type: options.mediaType, id: numericId }),
          })
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  return {
    id: params.id,
    slug: params.slug,
    title: slugTitle(params.slug, options.titleFallback),
    posterPath: data.poster_path ?? null,
    region,
  };
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

export type MediaDetailDestination =
  | {
      to: "/movie/$id/{-$slug}";
      params: { id: string; slug?: string };
      search?: { play?: true };
    }
  | {
      to: "/series/$id/{-$slug}";
      params: { id: string; slug?: string };
      search?: { play?: true };
    };

export function mediaDetailRoute(options: {
  mediaType: MediaKind;
  id: number | string;
  slug?: string;
  play?: boolean;
}): MediaDetailDestination {
  const params: { id: string; slug?: string } = {
    id: String(options.id),
    ...(options.slug ? { slug: options.slug } : {}),
  };
  const search = options.play ? ({ play: true } as const) : undefined;

  if (options.mediaType === "movie") {
    return {
      to: "/movie/$id/{-$slug}",
      params,
      ...(search ? { search } : {}),
    };
  }

  return {
    to: "/series/$id/{-$slug}",
    params,
    ...(search ? { search } : {}),
  };
}

export type TvSeasonDestination = {
  to: "/series/$id/{-$slug}/season/$seasonNumber";
  params: { id: string; slug?: string; seasonNumber: string };
};

export function tvSeasonRoute(options: {
  id: number | string;
  slug?: string;
  seasonNumber: number | string;
}): TvSeasonDestination {
  return {
    to: "/series/$id/{-$slug}/season/$seasonNumber",
    params: {
      id: String(options.id),
      seasonNumber: String(options.seasonNumber),
      ...(options.slug ? { slug: options.slug } : {}),
    },
  };
}

export type TvSeasonsDestination = {
  to: "/series/$id/{-$slug}/seasons";
  params: { id: string; slug?: string };
};

export function tvSeasonsRoute(options: {
  id: number | string;
  slug?: string;
}): TvSeasonsDestination {
  return {
    to: "/series/$id/{-$slug}/seasons",
    params: {
      id: String(options.id),
      ...(options.slug ? { slug: options.slug } : {}),
    },
  };
}

export type CollectionDestination = {
  to: "/collection/$id/{-$slug}";
  params: { id: string; slug?: string };
};

export function collectionRoute(options: {
  id: number | string;
  slug?: string;
}): CollectionDestination {
  return {
    to: "/collection/$id/{-$slug}",
    params: {
      id: String(options.id),
      ...(options.slug ? { slug: options.slug } : {}),
    },
  };
}
