'use client'
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
  const validtype = ['movie', 'tv', 'person'].includes(type ?? '') ? type : null

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['search', query, page],
    queryFn: async () => await getSearchResult(query, page),
    enabled: !!query,
    staleTime: 1000 * 60 * 60,
  })

  const handlePageChange = (newPage: number) => {
    if (!data || newPage < 1 || newPage > data.total_pages || newPage === page)
      return
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set('page', newPage.toString())
    router.replace(`?${newSearchParams.toString()}`)
  }

  const filteredData = (data?.results ?? []).filter(
    (item: SearchResultsEntity) => {
      if (validtype === null) return true
      return item.media_type === validtype
    },
  )

  const total_pages = data?.total_pages ?? 1
  if (!query || query.length < 1) {
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
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-[84px]" />
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

  if (!data || filteredData.length === 0) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="font-heading text-sm md:text-base lg:text-lg">
          No results found for your query
        </p>
      </div>
    )
  }

  const hasMovies =
    data?.results?.some((item) => item.media_type === 'movie') ?? false
  const hasTVShows =
    data?.results?.some((item) => item.media_type === 'tv') ?? false
  const hasPeople =
    data?.results?.some((item) => item.media_type === 'person') ?? false

  return (
    <section className="flex h-full flex-col gap-5">
      <div className="flex h-10 items-center justify-end">
        <div className="flex items-center gap-2">
          <SearchFilter
            activeTypes={[
              hasMovies ? 'movie' : '',
              hasTVShows ? 'tv' : '',
              hasPeople ? 'person' : '',
            ].filter(Boolean)}
          />
        </div>
      </div>
      <div className="flex min-h-96 w-full items-center justify-center">
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
      </div>
      <Pagination
        currentPage={page}
        totalPages={total_pages}
        onPageChange={handlePageChange}
      />
    </section>
  )
}
