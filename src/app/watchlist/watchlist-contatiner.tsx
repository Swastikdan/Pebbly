'use client'
import React from 'react'
import { useWatchListStore } from '@/store/watchlist-store'
import { MediaCard, MediaCardSkeleton } from '@/components/MediaCard'
import DefaultLoader from '@/components/DefaultLoader'

export default function WatchListContainer() {
  const { watchlist, loading } = useWatchListStore()

  //if (loading) return null

  return (
    <div className="flex min-h-96 w-full items-center justify-center">
      {loading ? (
        <DefaultLoader />
      ) : watchlist && watchlist.length > 0 ? (
        <div className="grid w-full grid-cols-2 gap-3 py-10 xs:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {watchlist.map(
            (item) =>
              item && (
                <MediaCard
                  key={item.externalId}
                  title={item.title}
                  rating={item.rating ?? 0}
                  poster_path={item.image ?? ''}
                  image={item.image ?? ''}
                  id={Number(item.externalId)}
                  media_type={item.type}
                  relese_date={item.releaseDate ?? null}
                />
              ),
          )}
        </div>
      ) : (
        <p className="font-heading w-full pb-20 text-center text-lg font-bold md:text-xl lg:text-2xl">
          No items in your watchlist
        </p>
      )}
    </div>
  )
}
