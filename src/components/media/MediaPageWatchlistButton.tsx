'use client'
import React from 'react'
import { useWatchListStore } from '@/store/watchlist-store'
import { Plus, Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
export default function MediaPageWatchlistButton({
  title,
  rating,
  image,
  id,
  media_type,
  relese_date,
  className,
}: {
  title: string
  rating: number
  image: string
  id: number
  media_type: 'movie' | 'tv'
  relese_date: string | null
  className?: string
}) {
  const { watchlist, update } = useWatchListStore()
  if (watchlist === null)
    return <Skeleton className={cn(className, 'size-9 p-2')} />
  const isOnWatchList = watchlist.some(
    (item) => item && item.externalId === id.toString(),
  )

  function handleWatchList(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    update({
      title,
      type: media_type,
      externalId: id.toString(),
      image,
      rating: rating,
      releaseDate: relese_date ?? undefined,
    })
  }
  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger className="cursor-pointer" asChild>
          <Badge
            onClick={handleWatchList}
            variant="default"
            className={cn(className, 'size-9 p-2')}
          >
            {isOnWatchList ? <Check size={24} /> : <Plus size={24} />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="cursor-none select-none">
          <p className="text-sm font-medium">
            {isOnWatchList ? 'Remove from Watchlist' : 'Add to Watchlist'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
