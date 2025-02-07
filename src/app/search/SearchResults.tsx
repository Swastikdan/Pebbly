// SearchResults.tsx
'use client'
import { useEffect } from 'react'
import { SearchResultsEntity } from '@/types/media'
import { useQuery } from '@tanstack/react-query'
import { getSearchResult } from '@/lib/getsearchresult'
import { MediaCard, MediaCardSkeleton } from '@/components/MediaCard'
import { useSearchParams, useRouter } from 'next/navigation'
import SearchFilter from './SearchFilter'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/ui/skeleton'

export default function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('query') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const type = searchParams.get('type')
  const validtype = ['movie', 'tv'].includes(type ?? '') ? type : null

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['search', query, page],
    queryFn: async () => await getSearchResult(query, page),
    enabled: !!query,
    staleTime: 1000 * 60 * 60,
  })

  const handlePageChange = (newPage: number) => {
    if (
      !data ||
      newPage < 1 ||
      newPage > data.total_pages ||
      newPage === page
    ) {
      return
    }
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set('page', newPage.toString())
    router.replace(`?${newSearchParams.toString()}`)
  }

  const filteredData = (data?.results ?? []).filter(
    (item: SearchResultsEntity) => {
      if (item.media_type === 'person') {
        return false
      }
      if (validtype === null) {
        return true
      }
      return item.media_type === validtype
    },
  )

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const currentPage = parseInt(params.get('page') || '1')

    // Reset invalid filters
    if (validtype && !filteredData.length) {
      params.delete('type')
    }

    // Validate page number
    if (data && currentPage > data.total_pages) {
      params.set('page', Math.min(currentPage, data.total_pages).toString())
      router.replace(`?${params.toString()}`)
    }
  }, [data, validtype, filteredData, router, searchParams])

  const hasMovies =
    data?.results?.some((item) => item.media_type === 'movie') ?? false
  const hasTVShows =
    data?.results?.some((item) => item.media_type === 'tv') ?? false

  if (!query) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="font-heading text-sm md:text-base lg:text-lg">
          Please enter a search query to get results
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="font-heading text-sm md:text-base lg:text-lg">
          Something went wrong. Please try again later
        </p>
      </div>
    )
  }

  if (isLoading || isFetching) {
    return (
      <section>
        <div className="flex h-10 items-center justify-between">
          <div></div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-[84px] rounded-md" />
            ))}
          </div>
        </div>
        <div className="grid w-full grid-cols-2 items-center justify-center gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <MediaCardSkeleton key={index} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full flex-col gap-5">
      <div className="flex h-10 items-center justify-end">
        <div className="flex items-center gap-2">
          <SearchFilter
            activeTypes={[
              ...(hasMovies ? ['movie'] : []),
              ...(hasTVShows ? ['tv'] : []),
            ]}
          />
        </div>
      </div>
      <div className="flex min-h-96 w-full items-center justify-center">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="font-heading text-sm md:text-base lg:text-lg">
              {data?.results?.length
                ? 'No movies or TV shows found in these results.'
                : 'No results found for your search query.'}
            </p>
            {data?.results && data.results.length > 0 && (
              <p className="text-muted-foreground">
                Try adjusting your search terms or filters.
              </p>
            )}
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 items-center justify-center gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredData.map((item) => (
              <MediaCard
                key={item.id}
                title={item.title || item.name || 'Untitled'}
                rating={item.vote_average ?? 0}
                poster_path={item.poster_path ?? ''}
                image={item.poster_path || item.profile_path || ''}
                media_type={item.media_type as 'movie' | 'tv' | 'person'}
                known_for_department={item.known_for_department ?? ''}
                id={item.id}
                relese_date={item.first_air_date || item.release_date || null}
              />
            ))}
          </div>
        )}
      </div>
      {data?.results && data.results.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={data?.total_pages ?? 1}
          onPageChange={handlePageChange}
        />
      )}
    </section>
  )
}
