import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { number, object, optional } from "valibot";

import type { MediaType } from "@/domain/media";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { GoBack } from "@/components/go-back";
import { MediaCard } from "@/components/media-card";
import { PagedMediaGrid } from "@/components/paged-media-grid";
import { ShareButton } from "@/components/share-button";
import { Pagination } from "@/components/ui/pagination";
import { useUrlPagedQuery } from "@/hooks/use-url-paged-query";
import { getDiscoverMovies, getKeywordDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

const keywordPageSearchSchema = object({
  page: optional(number()),
});

export const Route = createFileRoute("/keyword/$id")({
  validateSearch: keywordPageSearchSchema,
  loader: async ({ params }) => {
    const { id } = params;
    const keyword = await getKeywordDetails({ id: Number(id) });
    return { keyword };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.keyword?.name ?? "Keyword"} Movies | Pebbly`,
      },
      {
        name: "description",
        content: `Browse movies tagged with ${loaderData?.keyword?.name ?? "keyword"} on Pebbly.`,
      },
    ],
  }),
  component: KeywordPage,
});

function KeywordPage() {
  const { keyword } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/keyword/$id" });
  const { page: pageNumber } = useSearch({ from: "/keyword/$id" });
  const { id } = Route.useParams();

  const urlPage = pageNumber ?? 1;

  const {
    data: mediaListData,
    error: mediaListError,
    isFetching: isMediaListFetching,
    isLoading: isMediaListLoading,
  } = useQuery({
    queryKey: queryKeys.tmdb.discoverKeyword(Number(id), urlPage),
    queryFn: () =>
      getDiscoverMovies({ with_keywords: Number(id), page: urlPage }),
    enabled: typeof window !== "undefined" && !!id,
  });

  const { page, isPending, totalPages, handlePageChange } = useUrlPagedQuery({
    urlPage: pageNumber,
    totalPages: mediaListData?.total_pages,
    scrollToTop: true,
    goToPage: (newPage) => {
      navigate({
        to: "/keyword/$id",
        params: { id },
        search: { page: newPage },
      });
    },
  });

  const isLoading = isMediaListLoading || isMediaListFetching || isPending;
  const results = mediaListData?.results ?? [];
  const hasResults = !!results.length;
  const showPagination = (mediaListData?.total_pages ?? 0) > 1;

  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="top-0 w-full max-w-7xl items-center justify-center p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <GoBack title="Back" />
          <ShareButton title={`${keyword.name} Movies`} />
        </div>
        <h1 className="pb-5 text-start text-2xl font-bold capitalize md:text-3xl lg:text-4xl">
          {keyword.name} Movies
        </h1>

        <PagedMediaGrid
          isLoading={isLoading}
          showEmpty={!hasResults || !!mediaListError}
          empty={
            <DefaultEmptyState
              message="No movies found for this keyword"
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
              media_type={"movie" as MediaType}
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
