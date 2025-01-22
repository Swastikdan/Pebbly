import React from 'react'
import GoBack from '@/components/GoBack'
import ShareButton from '@/components/ShareButton'
import RatingCount from '@/components/media/RatingCount'
import WatchListButton from '@/components/WatchListButton'
export default function MediaTitleContailer({
  title,
  rateing,
  image,
  id,
  media_type,
  relese_date,
  description,
  tagline,
  releaseyear,
  uscertification,
  Runtime,
  vote_average,
  vote_count,
  imdb_url,
  tv_status,
}: {
  title: string
  rateing: number
  image: string
  id: number
  media_type: 'movie' | 'tv'
  relese_date: string | null
  description: string
  tagline: string | null
  releaseyear: string
  uscertification: string
  Runtime?: string | null
  vote_average: number | null
  vote_count: number | null
  imdb_url?: string | null
  tv_status?: string | null
}) {
  return (
    <div className="pb-5 pt-5">
      <div className="space-y-3 pb-5">
        <div className="flex items-center justify-between">
          <GoBack link="/" />
          <div className="flex items-center gap-3">
            <WatchListButton
              title={title}
              rating={rateing}
              image={image}
              id={id}
              media_type={media_type}
              relese_date={relese_date}
            />
            <ShareButton title={title} description={description} />
          </div>
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {imdb_url ? (
            <a
              href={imdb_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary hover:opacity-70"
            >
              {title}
            </a>
          ) : (
            title
          )}
        </h1>
        {tagline && <h2 className="hidden sm:flex">{tagline}</h2>}
      </div>
      <div className="flex flex-col items-start justify-start space-y-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="space-x-1 whitespace-nowrap font-light sm:text-lg">
          <span className="py-1">{releaseyear}</span>

          <span className="py-1">•</span>
          <span className="rounded-sm px-2 py-1 ring-1 ring-ring">
            {uscertification}
          </span>
          {Runtime && (
            <>
              <span className="py-1">•</span>
              <span className="py-1">{Runtime}</span>
            </>
          )}
          {tv_status && (
            <>
              <span className="py-1">•</span>
              <span className="py-1">{tv_status}</span>
            </>
          )}
        </span>
        <div className="hidden sm:flex">
          <RatingCount
            rating={Number(vote_average?.toFixed(1)) ?? 0}
            ratingcount={Number(vote_count ?? 0)}
          />
        </div>
      </div>
    </div>
  )
}
