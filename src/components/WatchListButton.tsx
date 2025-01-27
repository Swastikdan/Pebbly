'use client'
import React from 'react'
import { useWatchListStore } from '@/store/watchlist-store'
import { Plus, Check } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export default function WatchListButton({
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

  const isOnWatchList =
    watchlist?.some((item) => item?.externalId === id.toString()) ?? false

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
        <TooltipTrigger asChild>
          <Badge
            onClick={handleWatchList}
            variant="default"
            className={cn(className, 'z-20 size-9 p-2')}
            aria-label={
              isOnWatchList ? 'Remove from Watchlist' : 'Add to Watchlist'
            }
            role="button"
            aria-pressed={isOnWatchList}
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
