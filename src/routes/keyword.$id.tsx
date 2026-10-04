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
import { isMediaType } from "@/domain/media";
import { useUrlPagedQuery } from "@/hooks/use-url-paged-query";
import {
  getDiscoverMovies,
  getDiscoverTv,
  getKeywordDetails,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { requireRouteId } from "@/lib/route-helpers";

const keywordPageSearchSchema = object({
  page: optional(number()),
  type: optional(picklist(["movie", "tv"])),
});

export const Route = createFileRoute("/keyword/$id")({
  validateSearch: keywordPageSearchSchema,
  loader: async ({ params, context, location }) => {
    const keywordId = requireRouteId(params.id);
    const search = location.search as { page?: number; type?: MediaType };
    const page = search.page ?? 1;
    const mediaType: MediaType = search.type ?? "movie";
    const [keyword] = await Promise.all([
      getKeywordDetails({ id: keywordId }),
      context.queryClient.ensureQueryData({
        queryKey:
          mediaType === "tv"
            ? queryKeys.tmdb.discoverKeywordTv(keywordId, page)
            : queryKeys.tmdb.discoverKeyword(keywordId, page),
        queryFn: () =>
          mediaType === "tv"
            ? getDiscoverTv({ with_keywords: keywordId, page })
            : getDiscoverMovies({ with_keywords: keywordId, page }),
      }),
    ]);
    return { keyword, mediaType };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.keyword?.name ?? "Keyword"} ${
          loaderData?.mediaType === "tv" ? "TV Shows" : "Movies"
        } | Pebbly`,
      },
      {
        name: "description",
        content: `Browse ${
          loaderData?.mediaType === "tv" ? "TV shows" : "movies"
        } tagged with ${loaderData?.keyword?.name ?? "keyword"} on Pebbly.`,
      },
    ],
  }),
  pendingComponent: KeywordPageSkeleton,
  component: KeywordPage,
});

function KeywordPageSkeleton() {
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

function KeywordPage() {
  const { keyword } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/keyword/$id" });
  const { page: pageNumber, type: urlType } = useSearch({
    from: "/keyword/$id",
  });
  const { id } = Route.useParams();
  const mediaType: MediaType = urlType ?? "movie";
  const keywordId = requireRouteId(id);
  const urlPage = pageNumber ?? 1;

  const {
    data: mediaListData,
    error: mediaListError,
    isFetching: isMediaListFetching,
    isLoading: isMediaListLoading,
  } = useQuery({
    queryKey:
      mediaType === "tv"
        ? queryKeys.tmdb.discoverKeywordTv(keywordId, urlPage)
        : queryKeys.tmdb.discoverKeyword(keywordId, urlPage),
    queryFn: () =>
      mediaType === "tv"
        ? getDiscoverTv({ with_keywords: keywordId, page: urlPage })
        : getDiscoverMovies({ with_keywords: keywordId, page: urlPage }),
    placeholderData: keepPreviousData,
  });

  const { page, isPending, totalPages, handlePageChange } = useUrlPagedQuery({
    urlPage: pageNumber,
    totalPages: mediaListData?.total_pages,
    scrollToTop: true,
    goToPage: (newPage) => {
      navigate({
        to: "/keyword/$id",
        params: { id },
        search: {
          page: newPage,
          type: mediaType === "movie" ? undefined : mediaType,
        },
      });
    },
  });

  const isLoading = isMediaListLoading || isMediaListFetching || isPending;
  const results = mediaListData?.results ?? [];
  const hasResults = results.length > 0;
  const showPagination = (mediaListData?.total_pages ?? 0) > 1;
  const mediaLabel = mediaType === "tv" ? "TV Shows" : "Movies";

  const handleTypeChange = (nextType: MediaType) => {
    if (nextType === mediaType) return;
    navigate({
      to: "/keyword/$id",
      params: { id },
      search: { type: nextType === "movie" ? undefined : nextType },
    });
  };

  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="top-0 w-full max-w-7xl items-center justify-center p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <GoBack title="Back" />
          <ShareButton title={`${keyword.name} ${mediaLabel}`} />
        </div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-h1 text-start capitalize">
            {keyword.name} {mediaLabel}
          </h1>
          <div
            className="bg-secondary/50 border-border/40 dark:bg-secondary/30 dark:border-border/20 flex h-8 min-h-8 items-center gap-0.5 rounded-lg border p-0.5"
            role="tablist"
            aria-label="Keyword media type"
          >
            <Button
              className="h-7 rounded-md px-3 text-xs font-semibold"
              variant="ghost"
              onClick={() => handleTypeChange("movie")}
              data-active={mediaType === "movie"}
              aria-pressed={mediaType === "movie"}
              style={
                mediaType === "movie"
                  ? {
                      background: "var(--foreground)",
                      color: "var(--background)",
                    }
                  : undefined
              }
            >
              Movies
            </Button>
            <Button
              className="h-7 rounded-md px-3 text-xs font-semibold"
              variant="ghost"
              onClick={() => handleTypeChange("tv")}
              data-active={mediaType === "tv"}
              aria-pressed={mediaType === "tv"}
              style={
                mediaType === "tv"
                  ? {
                      background: "var(--foreground)",
                      color: "var(--background)",
                    }
                  : undefined
              }
            >
              Series
            </Button>
          </div>
        </div>

        <PagedMediaGrid
          isLoading={isLoading}
          showError={!!mediaListError}
          error={<DefaultErrorComponent />}
          showEmpty={!hasResults && !mediaListError}
          empty={
            <DefaultEmptyState
              message={`No ${mediaType === "tv" ? "TV shows" : "movies"} found for this keyword`}
              description={false}
            />
          }
          footer={
            showPagination ? (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            ) : null
          }
        >
          {results.map((item) => (
            <MediaCard
              card_type="horizontal"
              key={item.id}
              id={item.id}
              image={item.poster_path ?? ""}
              known_for_department={item.known_for_department ?? ""}
              media_type={
                isMediaType(item.media_type) ? item.media_type : mediaType
              }
              poster_path={item.poster_path ?? ""}
              rating={item.vote_average ?? 0}
              release_date={item.first_air_date ?? item.release_date ?? null}
              title={item.title ?? item.name ?? "Untitled"}
              overview={item.overview ?? ""}
            />
          ))}
        </PagedMediaGrid>
      </div>
    </section>
  );
}
