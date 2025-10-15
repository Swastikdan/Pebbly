/** biome-ignore-all lint/suspicious/noArrayIndexKey: explanation */
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Pagination } from "@/components/ui/pagination";
import { MAX_PAGINATION_LIMIT } from "@/constants";
import { getMediaList } from "@/lib/queries";
import type {
  MediaListQuery,
  MediaListResultsEntity,
  MediaType,
} from "@/types";

const MediaGrid = ({
  items,
  mediatype,
}: {
  items: MediaListResultsEntity[];
  mediatype: MediaType;
}) => (
  <div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    {items.map((item) => (
      <MediaCard
        card_type="horizontal"
        key={item.id}
        id={item.id}
        image={item.poster_path ?? ""}
        known_for_department={item.known_for_department ?? ""}
        media_type={mediatype}
        poster_path={item.poster_path ?? ""}
        rating={item.vote_average ?? 0}
        release_date={item.first_air_date ?? item.release_date ?? null}
        title={item.title ?? item.name ?? "Untitled"}
      />
    ))}
  </div>
);

const EmptyState = ({
  message,
  onReset,
  isHome,
}: {
  message?: string;
  onReset: () => void;
  isHome?: boolean;
}) => (
  <Empty className="border border-dashed my-10">
    <EmptyHeader>
      <EmptyTitle>{message ?? "No movies or TV shows found"}</EmptyTitle>
      <EmptyDescription>
        Try searching for something else or reset filters.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button onClick={onReset} variant="outline" size="lg">
        {isHome ? "Go Home" : "Reset"}
      </Button>
    </EmptyContent>
  </Empty>
);

const LoadingState = () => (
  <section className="flex h-full flex-col">
    <div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <MediaCardSkeleton key={index} card_type="horizontal" />
      ))}
    </div>
  </section>
);

export const MediaListPageResults = ({
  query,
  mediatype,
}: {
  query: MediaListQuery["type"];
  mediatype: "movie" | "tv";
}) => {
  const navigate = useNavigate({ from: "/list/$type/$slug" });
  const { page: pageNumber } = useSearch({ from: "/list/$type/$slug" });

  const [page, setPage] = useState(pageNumber ?? 1);
  const [isPending, setIsPending] = useState(false);

  const { data, error, isFetching, isLoading } = useQuery({
    queryKey: ["media-list", query, page],
    queryFn: () => getMediaList({ type: query, page }),
    enabled: !!query,
  });

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (
        !data ||
        newPage < 1 ||
        newPage > data.total_pages ||
        newPage === page
      ) {
        return;
      }

      setIsPending(true);
      const querySlug = query.split("_")[1];
      const typeSlug = mediatype === "movie" ? "movies" : "tv-shows";

      navigate({
        to: "/list/$type/$slug",
        params: { type: typeSlug, slug: querySlug },
        search: { page: newPage },
      });
    },
    [data, page, query, navigate, mediatype],
  );

  // Sync page from URL and clear pending
  useEffect(() => {
    if (pageNumber !== page) {
      setPage(pageNumber ?? 1);
    }
    setIsPending(false);
  }, [pageNumber, page]);

  if (!query) {
    return (
      <EmptyState
        onReset={() => {
          navigate({ to: "/" });
        }}
        isHome={true}
        message="There are no movies that matched your query."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        onReset={() => {
          const querySlug = query.split("_")[1];
          const typeSlug = mediatype === "movie" ? "movies" : "tv-shows";
          navigate({
            to: "/list/$type/$slug",
            params: { type: typeSlug, slug: querySlug },
            search: { page: 1 },
          });
        }}
        message="Something went wrong. Please try again later"
      />
    );
  }

  if (isLoading || isPending || isFetching) {
    return <LoadingState />;
  }

  const hasResults = !!data?.results?.length;
  const showPagination = hasResults && (data?.total_pages ?? 0) > 1;
  const totalPages = Math.min(data?.total_pages ?? 0, MAX_PAGINATION_LIMIT);

  return (
    <section className="flex h-full flex-col">
      <div className="flex min-h-96 w-full items-center justify-center">
        {data?.results?.length === 0 ? (
          <EmptyState
            onReset={() => {
              const querySlug = query.split("_")[1];
              const typeSlug = mediatype === "movie" ? "movies" : "tv-shows";
              navigate({
                to: "/list/$type/$slug",
                params: { type: typeSlug, slug: querySlug },
                search: { page: 1 },
              });
            }}
          />
        ) : (
          <MediaGrid items={data?.results ?? []} mediatype={mediatype} />
        )}
      </div>

      {showPagination && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </section>
  );
};
