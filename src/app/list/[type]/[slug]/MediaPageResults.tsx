// 'use client'

// import { getMediaData } from '@/lib/getmediadata'
// import { type MediaListDataQuery } from '@/types/media'
// import { MediaCard, MediaCardSkeleton } from '@/components/MediaCard'
// import InfiniteScroll from '@/components/InfiniteScroll'
// import { useInfiniteQuery } from '@tanstack/react-query'

// export default function MediaPageResults({
//   query,
//   mediatype,
// }: {
//   query: MediaListDataQuery['type']
//   mediatype: 'movie' | 'tv' | 'person'
// }) {
//   const {
//     data,
//     error,
//     fetchNextPage,
//     hasNextPage,
//     isFetching,
//     isFetchingNextPage,
//     status,
//   } = useInfiniteQuery({
//     queryKey: ['media_page', query],
//     queryFn: async ({ pageParam = 1 }) =>
//       getMediaData({ type: query, page: pageParam }),
//     initialPageParam: 1,
//     getNextPageParam: (lastPage) =>
//       lastPage.page < lastPage.total_pages ? lastPage.page + 1 : null,
//     staleTime: 1000 * 60 * 60, // Cache for 1 hour
//   })
//   if (error) {
//     return (
//       <div className="flex h-[70vh] items-center justify-center">
//         <p className="font-heading text-xl font-semibold">
//           Something went wrong. Please try again later
//         </p>
//       </div>
//     )
//   }

//   if (status === 'pending') {
//     return (
//       <section>
//         <div className="grid w-full grid-cols-2 items-center justify-center gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
//           {Array.from({ length: 12 }).map((_, index) => (
//             <MediaCardSkeleton key={index} />
//           ))}
//         </div>
//       </section>
//     )
//   }
//   return (
//     <div className="flex min-h-96 w-full items-center justify-center">
//       <div className="grid w-full grid-cols-2 items-center justify-center gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
//         {(data?.pages.reduce(
//           (total, page) => total + (page.results?.length || 0),
//           0,
//         ) || 0) > 0 ? (
//           data?.pages.map((page) =>
//             page.results?.map((item) => (
//               <MediaCard
//                 key={item.id}
//                 title={item.title || item.name || 'Untitled'}
//                 rating={item.vote_average ?? 0}
//                 poster_path={item.poster_path ?? ''}
//                 image={item.poster_path || item.profile_path || ''}
//                 media_type={mediatype}
//                 known_for_department={item.known_for_department ?? ''}
//                 id={item.id}
//                 relese_date={item.first_air_date || item.release_date || null}
//               />
//             )),
//           )
//         ) : (
//           <p className="font-heading w-full pb-20 text-center text-lg font-bold md:text-xl lg:text-2xl">
//             No items found
//           </p>
//         )}

//         <InfiniteScroll
//           hasMore={hasNextPage}
//           isLoading={isFetching || isFetchingNextPage}
//           next={() => fetchNextPage()}
//           threshold={0.5}
//         >
//           {isFetchingNextPage &&
//             Array.from({ length: 20 }).map((_, index) => (
//               <MediaCardSkeleton key={index} />
//             ))}
//         </InfiniteScroll>
//       </div>
//     </div>
//   )
// }

'use client'

import { getMediaData } from '@/lib/getmediadata'
import { type MediaListDataQuery } from '@/types/media'
import { MediaCard, MediaCardSkeleton } from '@/components/MediaCard'
import InfiniteScroll from '@/components/InfiniteScroll'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useRef } from 'react'

// Memoized MediaCard component
const MemoizedMediaCard = memo(MediaCard)

// Memoized MediaCardSkeleton
const MemoizedMediaCardSkeleton = memo(MediaCardSkeleton)

export default function MediaPageResults({
  query,
  mediatype,
}: {
  query: MediaListDataQuery['type']
  mediatype: 'movie' | 'tv' | 'person'
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['media_page', query],
    queryFn: async ({ pageParam = 1 }) =>
      getMediaData({ type: query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : null,
    staleTime: 1000 * 60 * 60,
  })

  // Flatten all items into a single array
  const allItems = data?.pages.flatMap((page) => page.results ?? []) ?? []

  const virtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300, // Adjust based on your card height
    overscan: 5, // Number of items to render outside of the viewport
  })

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
        <div className="grid w-full grid-cols-2 items-center justify-center gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <MemoizedMediaCardSkeleton key={index} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="flex min-h-96 w-full items-center justify-center">
      <div
        ref={parentRef}
        className="grid w-full grid-cols-2 items-center justify-center gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        style={{ height: '800px', overflow: 'auto' }}
      >
        {allItems.length > 0 ? (
          virtualizer.getVirtualItems().map((virtualRow) => {
            const item = allItems[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MemoizedMediaCard
                  title={item.title || item.name || 'Untitled'}
                  rating={item.vote_average ?? 0}
                  poster_path={item.poster_path ?? ''}
                  image={item.poster_path || item.profile_path || ''}
                  media_type={mediatype}
                  known_for_department={item.known_for_department ?? ''}
                  id={item.id}
                  relese_date={item.first_air_date || item.release_date || null}
                />
              </div>
            )
          })
        ) : (
          <p className="font-heading w-full pb-20 text-center text-lg font-bold md:text-xl lg:text-2xl">
            No items found
          </p>
        )}

        <InfiniteScroll
          hasMore={hasNextPage}
          isLoading={isFetching || isFetchingNextPage}
          next={() => fetchNextPage()}
          threshold={0.5}
        >
          {isFetchingNextPage &&
            Array.from({ length: 6 }).map((_, index) => (
              <MemoizedMediaCardSkeleton key={index} />
            ))}
        </InfiniteScroll>
      </div>
    </div>
  )
}
