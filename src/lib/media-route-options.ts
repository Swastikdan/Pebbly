import type {
  MediaKind,
  MediaRouteData,
  MediaRouteOptions,
} from "@/lib/route-helpers";
import type { BasicMovie, BasicTv } from "@/lib/tmdb-schemas";
import type { QueryClient } from "@tanstack/react-query";
import type { RouteComponent } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { SITE_CONFIG } from "@/constants";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { detailHead, loadMediaRouteData } from "@/lib/route-helpers";

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
        `${SITE_CONFIG.url}/${kind}/${loaderData.id}/${encodeURIComponent(loaderData.title)}${copy.urlSuffix ?? ""}`,
    }),
  });
}

function buildHeadCopy(
  titleSuffix: string,
  description: (title: string) => string,
  notFoundMovie: string,
  notFoundTv: string,
  urlSuffix?: string,
): Record<MediaKind, HeadCopy> {
  const suffixPart = titleSuffix ? ` ${titleSuffix}` : "";
  return {
    movie: {
      title: (title) => `${title}${suffixPart} | Pebbly`.trim(),
      description,
      notFoundDescription: notFoundMovie,
      urlSuffix,
    },
    tv: {
      title: (title) => `${title}${suffixPart} | Pebbly`.trim(),
      description,
      notFoundDescription: notFoundTv,
      urlSuffix,
    },
  };
}

const INDEX_HEAD = buildHeadCopy(
  "",
  (title) =>
    `Explore detailed information about ${title}, including cast, crew, reviews, and more.`,
  "Explore detailed information about movies on Pebbly.",
  "Explore detailed information about movies and shows on Pebbly.",
);

const MEDIA_HEAD = buildHeadCopy(
  "- Media",
  (title) => `Watch the latest videos and images of ${title}.`,
  "Explore the latest movie videos and images on Pebbly.",
  "Explore the latest videos and images on Pebbly.",
  "/media",
);

const CAST_CREW_HEAD = buildHeadCopy(
  "- Cast & Crew",
  (title) => `Explore the cast and crew of ${title}.`,
  "Discover the cast and crew of your favorite movies on Pebbly.",
  "Discover the cast and crew of your favorite shows on Pebbly.",
  "/cast-crew",
);

export function indexDetailSearch(search: Record<string, unknown>) {
  return {
    trailer: search.trailer as string | undefined,
    play: search.play === true || search.play === "true" ? true : undefined,
    video: search.video as string | undefined,
    backdrop: search.backdrop as string | undefined,
    poster: search.poster as string | undefined,
  };
}

export function mediaGallerySearch(search: Record<string, unknown>) {
  return {
    video: search.video as string | undefined,
    backdrop: search.backdrop as string | undefined,
    poster: search.poster as string | undefined,
  };
}

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
    pendingMs: 150,
    pendingComponent: DefaultLoader,
  };
}

export function mediaRouteOptions(kind: MediaKind, component: RouteComponent) {
  return {
    loader: buildLoader({ mediaType: kind }),
    head: buildHead(kind, MEDIA_HEAD[kind]),
    validateSearch: mediaGallerySearch,
    component,
    pendingMs: 150,
    pendingComponent: DefaultLoader,
  };
}

export function castCrewRouteOptions(
  kind: MediaKind,
  component: RouteComponent,
) {
  return {
    loader: buildLoader({ mediaType: kind }),
    head: buildHead(kind, CAST_CREW_HEAD[kind]),
    component,
    pendingMs: 150,
    pendingComponent: DefaultLoader,
  };
}

type BasicDetailsQueryOptions<D> = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<D>;
  enabled: boolean;
};

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
