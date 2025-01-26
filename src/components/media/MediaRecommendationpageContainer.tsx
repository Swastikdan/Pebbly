'use client'

import { useMemo, memo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { MediaRecommendations } from '@/types/MediaRecommendations'
import { getRecommendations } from '@/lib/getRecommendations'
import { MediaCard, MediaCardSkeleton } from '@/components/MediaCard'
import InfiniteScroll from '@/components/InfiniteScroll'

const MemoizedMediaCard = memo(MediaCard)

export default function MediaRecommendationpageContainer({
  type,
  id,
}: {
  type: 'movie' | 'tv'
  id: number
}) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['media_recommendations', type, id],
    queryFn: async ({ pageParam = 1 }) =>
      getRecommendations({ type, id, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : null,
    staleTime: 1000 * 60 * 60,
  })

  // Memoize flattened results
  const flattenedResults = useMemo(() => {
    return data?.pages.flatMap((page) => page.results || []) || []
  }, [data])

  // Memoize total items count
  const totalItems = useMemo(() => flattenedResults.length, [flattenedResults])

  // Pre-render media cards
  const mediaCards = useMemo(() => {
    return flattenedResults.map((item) => (
      <MemoizedMediaCard
        key={`${item.id}-${type}`}
        title={item.title || item.name || 'Untitled'}
        rating={item.vote_average ?? 0}
        poster_path={item.poster_path ?? ''}
        image={item.poster_path ?? ''}
        media_type={type}
        id={item.id}
        relese_date={item.first_air_date || item.release_date || null}
      />
    ))
  }, [flattenedResults, type])

  // Memoize skeleton cards
  const skeletonCards = useMemo(
    () =>
      Array.from({ length: 20 }).map((_, index) => (
        <MediaCardSkeleton key={`skeleton-${index}`} />
      )),
    [],
  )

  if (error) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="font-heading text-xl font-semibold">
          Something went wrong. Please try again later
        </p>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <section>
        <div className="grid w-full grid-cols-2 gap-3 py-10 xs:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {skeletonCards}
        </div>
      </section>
    )
  }

  return (
    <div className="flex min-h-96 w-full items-center justify-center px-[max(5vmin,1.5rem)]">
      <div className="grid w-full grid-cols-2 gap-3 py-10 xs:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {totalItems > 0 ? (
          mediaCards
        ) : (
          <p className="font-heading w-full pb-20 text-center text-lg font-bold md:text-xl lg:text-2xl">
            No items found
          </p>
        )}

        <InfiniteScroll
          hasMore={hasNextPage}
          isLoading={isFetching || isFetchingNextPage}
          next={fetchNextPage}
          threshold={0.5}
        >
          {isFetchingNextPage && skeletonCards}
        </InfiniteScroll>
      </div>
    </div>
  )
}
