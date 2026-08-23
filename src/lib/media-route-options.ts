import type {
  MediaKind,
  MediaRouteData,
  MediaRouteOptions,
} from "@/lib/route-helpers";
import type { BasicMovie, BasicTv } from "@/lib/tmdb-schemas";
import type { QueryClient } from "@tanstack/react-query";
import type { RouteComponent } from "@tanstack/react-router";
import { VITE_PUBLIC_APP_URL } from "@/constants";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { detailHead, loadMediaRouteData } from "@/lib/route-helpers";

/**
 * Option factories for the movie/tv twin routes (index, media, cast-crew).
 * Each pair differs only by media kind; every meta string, search param, and
 * loader option below is lifted verbatim from the original route files so the
 * generated routes behave identically.
 *
 * Usage: `createFileRoute("/movie/$id/{-$slug}/media")(mediaRouteOptions("movie", MovieMediaPage))`
 * — the createFileRoute call stays literal in each file (router requirement).
 */

type RouteContext = { queryClient: QueryClient };
type RouteParams = { id: string; slug?: string };

function buildLoader(options: MediaRouteOptions) {
  return ({
    context,
    params,
  }: {
    context: RouteContext;
    params: RouteParams;
  }) => loadMediaRouteData(context, params, options);
}

type HeadCopy = {
  title: (title: string) => string;
  description: (title: string) => string;
  notFoundDescription: string;
  urlSuffix?: string;
};

function buildHead(kind: MediaKind, copy: HeadCopy) {
  return ({ loaderData }: { loaderData?: MediaRouteData }) => ({
    meta: detailHead({
      title: loaderData?.title
        ? copy.title(loaderData.title)
        : "Page Not Found | Pebbly",
      description: loaderData?.title
        ? copy.description(loaderData.title)
        : copy.notFoundDescription,
      posterPath: loaderData?.posterPath,
      url:
        loaderData?.id &&
        loaderData?.title &&
        `${VITE_PUBLIC_APP_URL}/${kind}/${loaderData.id}/${encodeURIComponent(loaderData.title)}${copy.urlSuffix ?? ""}`,
    }),
  });
}

const INDEX_HEAD: Record<MediaKind, HeadCopy> = {
  movie: {
    title: (title) => `${title} | Pebbly`,
    description: (title) =>
      `Explore detailed information about ${title}, including cast, crew, reviews, and more.`,
    notFoundDescription: "Explore detailed information about movies on Pebbly.",
  },
  tv: {
    title: (title) => `${title} | Pebbly`,
    description: (title) =>
      `Explore detailed information about ${title}, including cast, crew, reviews, and more.`,
    notFoundDescription:
      "Explore detailed information about movies and shows on Pebbly.",
  },
};

const MEDIA_HEAD: Record<MediaKind, HeadCopy> = {
  movie: {
    title: (title) => `${title} - Media | Pebbly`,
    description: (title) => `Watch the latest videos and images of ${title}.`,
    notFoundDescription:
      "Explore the latest movie videos and images on Pebbly.",
    urlSuffix: "/media",
  },
  tv: {
    title: (title) => `${title} - Media | Pebbly`,
    description: (title) => `Watch the latest videos and images of ${title}.`,
    notFoundDescription: "Explore the latest videos and images on Pebbly.",
    urlSuffix: "/media",
  },
};

const CAST_CREW_HEAD: Record<MediaKind, HeadCopy> = {
  movie: {
    title: (title) => `${title} - Cast & Crew | Pebbly`,
    description: (title) => `Explore the cast and crew of ${title}.`,
    notFoundDescription:
      "Discover the cast and crew of your favorite movies on Pebbly.",
    urlSuffix: "/cast-crew",
  },
  tv: {
    title: (title) => `${title} - Cast & Crew | Pebbly`,
    description: (title) => `Explore the cast and crew of ${title}.`,
    notFoundDescription:
      "Discover the cast and crew of your favorite shows on Pebbly.",
    urlSuffix: "/cast-crew",
  },
};

/** Search params for the index routes: trailer/play/video/backdrop/poster. */
export function indexDetailSearch(search: Record<string, unknown>) {
  return {
    trailer: search.trailer as string | undefined,
    play: search.play === true || search.play === "true" ? true : undefined,
    video: search.video as string | undefined,
    backdrop: search.backdrop as string | undefined,
    poster: search.poster as string | undefined,
  };
}

/** Search params for the media gallery routes: video/backdrop/poster. */
export function mediaGallerySearch(search: Record<string, unknown>) {
  return {
    video: search.video as string | undefined,
    backdrop: search.backdrop as string | undefined,
    poster: search.poster as string | undefined,
  };
}

/** Options for `/movie|$tv/$id/{-$slug}/` (full detail hydration). */
export function indexRouteOptions(kind: MediaKind, component: RouteComponent) {
  return {
    loader: buildLoader({
      mediaType: kind,
      level: "full",
      titleFallback: kind === "movie" ? "Movie Page" : "Tv Page",
    }),
    head: buildHead(kind, INDEX_HEAD[kind]),
    validateSearch: indexDetailSearch,
    component,
  };
}

/** Options for `/movie|$tv/$id/{-$slug}/media`. */
export function mediaRouteOptions(kind: MediaKind, component: RouteComponent) {
  return {
    loader: buildLoader({ mediaType: kind }),
    head: buildHead(kind, MEDIA_HEAD[kind]),
    validateSearch: mediaGallerySearch,
    component,
  };
}

/** Options for `/movie|$tv/$id/{-$slug}/cast-crew`. */
export function castCrewRouteOptions(
  kind: MediaKind,
  component: RouteComponent,
) {
  return {
    loader: buildLoader({ mediaType: kind }),
    head: buildHead(kind, CAST_CREW_HEAD[kind]),
    component,
  };
}

type BasicDetailsQueryOptions<D> = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<D>;
  enabled: boolean;
};

/** useQuery options for the lean details payload backing the subpages. */
export function basicDetailsQuery(
  kind: "movie",
  id: string,
): BasicDetailsQueryOptions<BasicMovie>;
export function basicDetailsQuery(
  kind: "tv",
  id: string,
): BasicDetailsQueryOptions<BasicTv>;
export function basicDetailsQuery(
  kind: MediaKind,
  id: string,
): BasicDetailsQueryOptions<BasicMovie> | BasicDetailsQueryOptions<BasicTv> {
  if (kind === "movie") {
    return {
      queryKey: queryKeys.tmdb.basicMovieDetails(Number(id)),
      queryFn: async () => await getBasicMovieDetails({ id: parseInt(id, 10) }),
      enabled: !!id,
    };
  }
  return {
    queryKey: queryKeys.tmdb.basicTvDetails(Number(id)),
    queryFn: async () => await getBasicTvDetails({ id: parseInt(id, 10) }),
    enabled: !!id,
  };
}
