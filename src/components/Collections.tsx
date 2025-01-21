'use client'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCollection } from '@/lib/getcollection'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
export default function Collections({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['collection', id],
    queryFn: async () => await getCollection({ id }),
  })
  if (!isLoading)
    return (
      <>
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-2xl md:h-52 lg:h-60" />
        ) : (
          <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-secondary md:h-52 lg:h-60">
            <div
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.9036624649859944) 0%, rgba(0,0,0,0.7120098039215687) 55%, rgba(13,13,13,0.2111694677871149) 100%), url(https://image.tmdb.org/t/p/w1440_and_h320_multi_faces/${data?.backdrop_path})`,
              }}
            />

            <div className="relative flex h-full flex-col items-start justify-center p-5">
              <span className="text-lg font-bold text-primary-foreground dark:text-primary md:text-xl lg:text-2xl xl:text-3xl">
                Part of the {data?.name}
              </span>
              <span className="mt-2 flex flex-wrap text-xs font-light text-primary-foreground dark:text-primary md:text-sm lg:text-base">
                Includes{' '}
                {data?.parts?.map((part) => part.title)?.join(', ') ?? ''}
              </span>
              <Link href={`/collection/${id}`}>
                <Button
                  variant="default"
                  size="lg"
                  className="mt-3 rounded-full bg-primary-foreground font-medium text-primary shadow hover:bg-primary-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                  View Collection
                </Button>
              </Link>
            </div>
          </div>
        )}
      </>
    )
}
