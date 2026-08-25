import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  notFound,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { number, object, optional } from "valibot";

import type { MediaListQuery, MediaType } from "@/types";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { DefaultErrorComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { MediaCard } from "@/components/media-card";
import { PagedMediaGrid } from "@/components/paged-media-grid";
import { ShareButton } from "@/components/share-button";
import { Pagination } from "@/components/ui/pagination";
import { MEDIA_PAGE_SLUGS, SITE_CONFIG } from "@/constants";
import { useUrlPagedQuery } from "@/hooks/use-url-paged-query";
import { mediaTypeToSlug, slugToMediaType } from "@/lib/media-types";
import { getMediaList } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

const NAV_ITEMS = SITE_CONFIG.navItems;

const listPageSearchSchema = object({
  page: optional(number()),
});

export const Route = createFileRoute("/list/$type/$slug")({
  validateSearch: listPageSearchSchema,
  loader: async ({ params }) => {
    const { type, slug } = params;

    const isValidSlug = MEDIA_PAGE_SLUGS.some(
      (item) => item.type === type && item.slug === slug,
    );

    if (!isValidSlug) {
      throw notFound();
    }

    const navItem = NAV_ITEMS.find((item) => item.slug === type);
    const subNavItem = navItem?.submenu.find((item) => item.slug === slug);

    if (!navItem || !subNavItem) {
      throw notFound();
    }

    const mediatype = slugToMediaType(type) ?? "tv";
    const query = `${type}_${slug}` as MediaListQuery["type"];

    return { navItem, subNavItem, mediatype, query };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData?.navItem && loaderData?.subNavItem
            ? `${loaderData.navItem.name} ${loaderData.subNavItem.name} | Pebbly`
            : "Page Not Found | Pebbly",
      },
      {
        name: "description",
        content:
          loaderData?.navItem && loaderData?.subNavItem
            ? `Browse ${loaderData.subNavItem.name} ${loaderData.navItem.name} | Pebbly`
            : "Explore movies and shows on Pebbly.",
      },
    ],
  }),
  component: MediaListPage,
});

function MediaListPage() {
  const { mediatype, query, navItem, subNavItem } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/list/$type/$slug" });
  const { page: pageNumber } = useSearch({ from: "/list/$type/$slug" });

  const urlPage = pageNumber ?? 1;

  const {
    data: mediaListData,
    error: mediaListError,
    isFetching: isMediaListFetching,
    isLoading: isMediaListLoading,
  } = useQuery({
    queryKey: queryKeys.tmdb.mediaList(query, urlPage),
    queryFn: () => getMediaList({ type: query, page: urlPage }),
    enabled: typeof window !== "undefined" && !!query,
  });

  const { page, isPending, totalPages, handlePageChange } = useUrlPagedQuery({
    urlPage: pageNumber,
    totalPages: mediaListData?.total_pages,
    scrollToTop: true,
    goToPage: (newPage) => {
      navigate({
        to: "/list/$type/$slug",
        params: {
          type: mediaTypeToSlug(mediatype),
          slug: query.split("_")[1],
        },
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
      <div className="top-0 w-full max-w-screen-xl items-center justify-center p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <GoBack title="Back" />
          <ShareButton title={`${subNavItem.name} ${navItem.name}`} />
        </div>
        <h1 className="animate-fade-in-up text-start text-2xl font-bold tracking-tight md:text-3xl">
          {subNavItem.name} {navItem.name}
        </h1>

        <PagedMediaGrid
          isLoading={isLoading}
          showError={!!mediaListError}
          error={<DefaultErrorComponent />}
          showEmpty={!hasResults}
          empty={
            <DefaultEmptyState
              message="No movies or TV shows found"
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
          {results.map((item, index) => (
            <MediaCard
              card_type="horizontal"
              key={item.id}
              id={item.id}
              image={item.poster_path ?? ""}
              known_for_department={item.known_for_department ?? ""}
              media_type={mediatype as unknown as MediaType}
              poster_path={item.poster_path ?? ""}
              rating={item.vote_average ?? 0}
              release_date={item.first_air_date ?? item.release_date ?? null}
              title={item.title ?? item.name ?? "Untitled"}
              overview={item.overview}
              priority={index < 7}
            />
          ))}
        </PagedMediaGrid>
      </div>
    </section>
  );
}
