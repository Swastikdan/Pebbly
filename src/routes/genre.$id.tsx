import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { number, object, optional, picklist } from "valibot";

import type { MediaType } from "@/domain/media";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { DefaultErrorComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { MediaCard } from "@/components/media-card";
import { PagedMediaGrid } from "@/components/paged-media-grid";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { GENRE_LIST } from "@/constants";
import { useUrlPagedQuery } from "@/hooks/use-url-paged-query";
import { getDiscoverMovies, getDiscoverTv } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { requireRouteId } from "@/lib/route-helpers";

const genrePageSearchSchema = object({
  page: optional(number()),
  type: optional(picklist(["all", "movie", "tv"])),
});

type GenreType = "all" | MediaType;

type GenreResult = {
  item: Awaited<ReturnType<typeof getDiscoverMovies>>["results"][number];
  mediaType: MediaType;
};

export const Route = createFileRoute("/genre/$id")({
  validateSearch: genrePageSearchSchema,
  loader: async ({ params, context, location }) => {
    const genreId = requireRouteId(params.id);
    const search = location.search as { page?: number; type?: GenreType };
    const page = search.page ?? 1;
    const type: GenreType = search.type ?? "all";

    await Promise.all([
      type === "tv"
        ? Promise.resolve()
        : context.queryClient.ensureQueryData({
            queryKey: queryKeys.tmdb.discoverGenre(genreId, "movie", page),
            queryFn: () =>
              getDiscoverMovies({ with_genres: String(genreId), page }),
          }),
      type === "movie"
        ? Promise.resolve()
        : context.queryClient.ensureQueryData({
            queryKey: queryKeys.tmdb.discoverGenre(genreId, "tv", page),
            queryFn: () =>
              getDiscoverTv({ with_genres: String(genreId), page }),
          }),
    ]);

    return { genreId, type };
  },
  head: ({ loaderData }) => {
    const genreName =
      GENRE_LIST.find((genre) => genre.id === loaderData?.genreId)?.name ??
      `Genre ${loaderData?.genreId ?? ""}`;
    const typeLabel =
      loaderData?.type === "tv"
        ? "TV Shows"
        : loaderData?.type === "movie"
          ? "Movies"
          : "Movies and TV Shows";

    return {
      meta: [
        { title: `${genreName} ${typeLabel} | Pebbly` },
        {
          name: "description",
          content: `Discover ${genreName.toLowerCase()} movies and TV shows on Pebbly.`,
        },
      ],
    };
  },
  pendingComponent: GenrePageSkeleton,
  component: GenrePage,
});

function GenrePageSkeleton() {
  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="top-0 w-full max-w-7xl items-center justify-center p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <GoBack title="Back" />
        </div>
        <div className="bg-muted h-10 w-48 animate-pulse rounded pb-5" />
        <PagedMediaGrid isLoading={true}>{null}</PagedMediaGrid>
      </div>
    </section>
  );
}

function GenrePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate({ from: "/genre/$id" });
  const { page: pageNumber, type: urlType } = useSearch({
    from: "/genre/$id",
  });
  const genreId = requireRouteId(id);
  const type: GenreType = urlType ?? "all";
  const urlPage = pageNumber ?? 1;
  const genreName =
    GENRE_LIST.find((genre) => genre.id === genreId)?.name ??
    `Genre ${genreId}`;

  const movieQuery = useQuery({
    queryKey: queryKeys.tmdb.discoverGenre(genreId, "movie", urlPage),
    queryFn: () =>
      getDiscoverMovies({ with_genres: String(genreId), page: urlPage }),
    enabled: type !== "tv",
    placeholderData: keepPreviousData,
  });
  const tvQuery = useQuery({
    queryKey: queryKeys.tmdb.discoverGenre(genreId, "tv", urlPage),
    queryFn: () =>
      getDiscoverTv({ with_genres: String(genreId), page: urlPage }),
    enabled: type !== "movie",
    placeholderData: keepPreviousData,
  });

  const movieResults: GenreResult[] = (movieQuery.data?.results ?? []).map(
    (item) => ({ item, mediaType: "movie" }),
  );
  const tvResults: GenreResult[] = (tvQuery.data?.results ?? []).map(
    (item) => ({
      item,
      mediaType: "tv",
    }),
  );
  const results =
    type === "movie"
      ? movieResults
      : type === "tv"
        ? tvResults
        : [...movieResults, ...tvResults];

  const totalPages =
    type === "movie"
      ? movieQuery.data?.total_pages
      : type === "tv"
        ? tvQuery.data?.total_pages
        : Math.max(
            movieQuery.data?.total_pages ?? 1,
            tvQuery.data?.total_pages ?? 1,
          );
  const {
    page,
    isPending,
    totalPages: pagedTotalPages,
    handlePageChange,
  } = useUrlPagedQuery({
    urlPage: pageNumber,
    totalPages,
    scrollToTop: true,
    goToPage: (newPage) => {
      navigate({
        to: "/genre/$id",
        params: { id },
        search: {
          page: newPage,
          type: type === "all" ? undefined : type,
        },
      });
    },
  });

  const isLoading =
    (type !== "tv" && (movieQuery.isLoading || movieQuery.isFetching)) ||
    (type !== "movie" && (tvQuery.isLoading || tvQuery.isFetching)) ||
    isPending;
  const hasError =
    (type !== "tv" && !!movieQuery.error) ||
    (type !== "movie" && !!tvQuery.error);
  const hasResults = results.length > 0;
  const mediaLabel =
    type === "tv" ? "TV Shows" : type === "movie" ? "Movies" : "Movies & TV";

  const handleTypeChange = (nextType: GenreType) => {
    if (nextType === type) return;
    navigate({
      to: "/genre/$id",
      params: { id },
      search: { type: nextType === "all" ? undefined : nextType },
    });
  };

  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="top-0 w-full max-w-7xl items-center justify-center p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <GoBack title="Back" />
          <ShareButton title={`${genreName} ${mediaLabel}`} />
        </div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-h1 text-start capitalize">{genreName}</h1>
          <div
            className="bg-secondary/50 border-border/40 dark:bg-secondary/30 dark:border-border/20 flex h-8 min-h-8 items-center gap-0.5 rounded-lg border p-0.5"
            role="tablist"
            aria-label="Genre media type"
          >
            {(
              [
                ["all", "All"],
                ["movie", "Movies"],
                ["tv", "Series"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                className="h-7 rounded-md px-3 text-xs font-semibold"
                variant="ghost"
                onClick={() => handleTypeChange(value)}
                data-active={type === value}
                aria-pressed={type === value}
                style={
                  type === value
                    ? {
                        background: "var(--foreground)",
                        color: "var(--background)",
                      }
                    : undefined
                }
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <PagedMediaGrid
          isLoading={isLoading}
          showError={hasError}
          error={<DefaultErrorComponent />}
          showEmpty={!hasResults && !hasError}
          empty={
            <DefaultEmptyState
              message={`No ${mediaLabel.toLowerCase()} found for this genre`}
              description={false}
            />
          }
          footer={
            pagedTotalPages > 1 ? (
              <Pagination
                currentPage={page}
                totalPages={pagedTotalPages}
                onPageChange={handlePageChange}
              />
            ) : null
          }
        >
          {results.map(({ item, mediaType }) => (
            <MediaCard
              card_type="horizontal"
              key={`${mediaType}-${item.id}`}
              id={item.id}
              image={item.poster_path ?? ""}
              known_for_department={item.known_for_department ?? ""}
              media_type={mediaType}
              poster_path={item.poster_path ?? ""}
              rating={item.vote_average ?? 0}
              release_date={item.first_air_date ?? item.release_date ?? null}
              title={item.title ?? item.name ?? "Untitled"}
              overview={item.overview ?? ""}
              priority={false}
            />
          ))}
        </PagedMediaGrid>
      </div>
    </section>
  );
}
