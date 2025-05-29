"use client";

import { useMemo, memo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getMediaRecommendations } from "@/lib/queries";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import InfiniteScroll from "react-infinite-scroll-component";

const MemoizedMediaCard = memo(MediaCard);

export default function MediaRecommendationPageContainer({
  type,
  id,
}: {
  type: "movie" | "tv";
  id: number;
}) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    //isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["media_recommendations", type, id],
    queryFn: async ({ pageParam = 1 }) =>
      getMediaRecommendations({ type, id, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : null,
    staleTime: 1000 * 60 * 60,
  });

  // Memoize flattened results
  const flattenedResults = useMemo(() => {
    return data?.pages.flatMap((page) => page.results ?? []) ?? [];
  }, [data]);

  // Memoize total items count
  //const totalItems = useMemo(() => flattenedResults.length, [flattenedResults]);

  // Pre-render media cards
  const mediaCards = useMemo(() => {
    return flattenedResults.map((item) => (
      <MemoizedMediaCard
        key={`${item.id}-${type}`}
        title={item.title ?? item.name ?? "Untitled"}
        rating={item.vote_average ?? 0}
        poster_path={item.poster_path ?? ""}
        image={item.poster_path ?? ""}
        media_type={type}
        id={item.id}
        relese_date={item.first_air_date ?? item.release_date ?? null}
      />
    ));
  }, [flattenedResults, type]);

  // Memoize skeleton cards
  const skeletonCards = useMemo(
    () =>
      Array.from({ length: 20 }).map((_, index) => (
        <MediaCardSkeleton key={`skeleton-${index}`} />
      )),
    [],
  );

  if (error) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="font-heading text-xl font-semibold">
          Something went wrong. Please try again later
        </p>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <section>
        <div className="xs:gap-4 grid w-full grid-cols-2 gap-3 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {skeletonCards}
        </div>
      </section>
    );
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
        {flattenedResults.length > 0 ? (
          <div className="xs:gap-4 grid w-full grid-cols-2 gap-3 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {mediaCards}
            {isFetchingNextPage && skeletonCards}
          </div>
        ) : (
          <p className="font-heading flex w-full items-center justify-center pb-20 text-center text-lg font-bold md:text-xl lg:text-2xl">
            No items found
          </p>
        )}
      </InfiniteScroll>
    </div>
  );
}
