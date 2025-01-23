'use client'
import React, { cache } from 'react'
import Link from 'next/link'
import Image from '@/components/Image'
import { Star } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getTvDetails } from '@/lib/gettvdetails'
import DefaultLoader from '@/components/DefaultLoader'
import { Badge } from '@/components/ui/badge'
import { IMAGE_PREFIX } from '@/constants'

interface SeasonContainerProps {
  tv_id_param: number
  id: string
  urltitle: string
}

export default function SeasonContainer({
  tv_id_param,
  id,
  urltitle,
}: SeasonContainerProps) {
  const { data, isLoading } = cache(() =>
    useQuery({
      queryKey: ['tv_details', tv_id_param],
      queryFn: async () => await getTvDetails({ id: tv_id_param }),
      staleTime: 1000 * 60 * 60 * 24,
    }),
  )()

  if (isLoading) {
    return <DefaultLoader />
  }

  return (
    <div className="flex flex-col gap-5 py-5 pb-32">
      {data?.seasons?.map((season) => (
        <div
          key={season.id}
          className="flex items-start gap-5 rounded-3xl border-2 border-border p-3 md:p-5"
          role="region"
          aria-label={`Current Season: ${season.name}`}
        >
          <div className="min-w-[7rem] md:min-w-[9rem]">
            <Link
              href={`/tv/${id}/${urltitle}/seasons/${season.season_number}`}
              className="transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70"
              aria-label={`View season ${season.season_number} details`}
            >
              <Image
                width={200}
                height={300}
                src={IMAGE_PREFIX.HD_POSTER + season.poster_path}
                className="h-40 w-28 shrink-0 rounded-xl object-cover md:h-52 md:w-36"
                alt={season.name}
              />
            </Link>
          </div>
          <div className="flex flex-1 flex-col items-start justify-center gap-2 overflow-hidden py-3">
            <Link
              href={`/tv/${id}/${urltitle}/seasons/${season.season_number}`}
              className="line-clamp-1 text-xl font-bold transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70 md:text-2xl"
              aria-label={`View season ${season.season_number} details`}
            >
              {season.name}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {season.vote_average > 0 && (
                <Badge
                  variant="secondary"
                  className="inline-flex items-center gap-1 rounded-md px-3 text-sm font-light"
                  aria-label={`Rating: ${season.vote_average * 10}%`}
                >
                  <Star size={16} className="size-3 fill-current" />
                  {season.vote_average * 10} %
                </Badge>
              )}
              <span className="text-sm">
                {season.air_date?.split('-')[0] || 'TBA'}
              </span>
              {` • `}
              <span className="text-sm">{season.episode_count} Episodes</span>
            </div>
            <span className="line-clamp-3 text-sm md:text-base">
              {season.overview || 'No overview available'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
