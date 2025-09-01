"use client";
import type {
  MediaListQuery,
  MediaListResultsEntity,
  MediaType,
} from "@/types";

import React, { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@heroui/pagination";
import { Button } from "@heroui/button";

import { getMediaList } from "@/lib/quries";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { MAX_PAGINATION_LIMIT } from "@/config/common";

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

const EmptyMessage = ({ message }: { message: string }) => (
  <div className="flex h-[70vh] items-center justify-center">
    <p className="font-heading text-sm md:text-base lg:text-lg">{message}</p>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center gap-4 text-center">
    <p className="font-heading text-sm md:text-base lg:text-lg">
      No movies or TV shows found
    </p>
  </div>
);

const LoadingState = () => (
  <section className="flex h-full flex-col">
    <div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <MediaCardSkeleton key={index} />
      ))}
    </div>
  </section>
);

export function MediaListPageResults({
  query,
  mediatype,
}: {
  query: MediaListQuery["type"];
  mediatype: "movie" | "tv";
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const [page, setPage] = useState(initialPage);
  const [isPending, setIsPending] = useState(false);

  const { data, error, isFetching, isLoading } = useQuery({
    queryKey: ["search", query, page],
    queryFn: () => getMediaList({ type: query, page }),
    enabled: !!query,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 2,
    refetchOnWindowFocus: false,
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

      const params = new URLSearchParams(searchParams.toString());

      params.set("page", String(newPage));

      router.push(
        `/list/${mediatype === "movie" ? "movies" : "tv-shows"}/${query.split("_")[1]}?${params.toString()}`,
      );
    },
    [data, page, searchParams, query, router, mediatype],
  );

  // Sync page from URL and clear pending
  useEffect(() => {
    const currentPage = parseInt(searchParams.get("page") ?? "1", 10);

    if (currentPage !== page) setPage(currentPage);
    setIsPending(false);
  }, [searchParams, page]);

  if (!query) {
    return (
      <EmptyMessage message="There are no movies that matched your query." />
    );
  }

  if (error) {
    return (
      <EmptyMessage message="Something went wrong. Please try again later" />
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
          <EmptyState />
        ) : (
          <MediaGrid items={data?.results ?? []} mediatype={mediatype} />
        )}
      </div>

      {showPagination && (
        <div
          aria-label="Pagination Navigation"
          className="flex items-center justify-center gap-5 font-medium md:gap-1"
        >
          <Button
            className="disabled:opacity-50"
            disabled={page === 1}
            variant="solid"
            onPress={() => handlePageChange(page - 1)}
          >
            Prev
          </Button>

          <div className="bg-default flex h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 font-normal md:hidden">
            <span className="text-base">Page</span>
            <div className="flex items-center gap-2">
              <span aria-current="page" className="text-base">
                {page}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground text-base">
                {totalPages}
              </span>
            </div>
          </div>

          <Pagination
            className="hidden md:block"
            classNames={{ item: "w-full" }}
            initialPage={1}
            page={page}
            size="lg"
            total={totalPages}
            variant="bordered"
            onChange={handlePageChange}
          />

          <Button
            className="disabled:opacity-50"
            disabled={page === totalPages}
            variant="solid"
            onPress={() => handlePageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}

MediaListPageResults.displayName = "MediaListPageResults";
