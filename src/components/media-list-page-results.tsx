"use client";

import React, { useMemo, memo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type MediaListQuery } from "@/types";
import { getMediaList } from "@/lib/queries";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import InfiniteScroll from "react-infinite-scroll-component";
import DefaultLoader from "./default-loader";
const MemoizedMediaCard = memo(MediaCard);
const skeletonCards = Array.from({ length: 20 }).map((_, index) => (
  <MediaCardSkeleton key={`skeleton-${index}`} />
));

function MediaListPageResults({
  query,
  mediatype,
}: {
  query: MediaListQuery["type"];
  mediatype: "movie" | "tv";
}) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["media_page", query],
    queryFn: async ({ pageParam = 1 }) =>
      getMediaList({ type: query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : null,
    staleTime: 1000 * 60 * 60,
  });

  const flattenedResults = useMemo(() => {
    return data?.pages.flatMap((page) => page.results ?? []) ?? [];
  }, [data]);

  const mediaCards = useMemo(() => {
    return flattenedResults.map((item, index) => (
      <MemoizedMediaCard
        key={`${item.id}-${mediatype}+${index}`}
        title={item.title ?? item.name ?? "Untitled"}
        rating={item.vote_average ?? 0}
        poster_path={item.poster_path ?? ""}
        image={item.poster_path ?? ""}
        media_type={mediatype}
        known_for_department={item.known_for_department ?? ""}
        id={item.id}
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        relese_date={item.first_air_date ?? item.release_date ?? null}
        prefetch={false}
      />
    ));
  }, [flattenedResults, mediatype]);

  if (error) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="font-heading text-xl font-semibold">
          Something went wrong. Please try again later.
        </p>
      </div>
    );
  }

  if (status === "pending") {
    return <DefaultLoader />;
  }

  return (
    <div className="flex min-h-96 w-full items-center justify-center">
      <InfiniteScroll
        dataLength={flattenedResults.length}
        next={fetchNextPage}
        hasMore={hasNextPage}
        loader={null}
        endMessage={null}
      >
        <div className="xs:gap-4 grid w-full grid-cols-2 gap-3 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {flattenedResults.length > 0 ? (
            <>
              {mediaCards}
              {isFetchingNextPage && skeletonCards}
            </>
          ) : (
            <p className="font-heading w-full pb-20 text-center text-lg font-bold md:text-xl lg:text-2xl">
              No items found
            </p>
          )}
        </div>
      </InfiniteScroll>
    </div>
  );
}

export default memo(MediaListPageResults);
