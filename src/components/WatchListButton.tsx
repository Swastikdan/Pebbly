"use client";
import React from "react";
import { useWatchList } from "@/hooks/watchlist";
import { Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";
export default function WatchListButton({
  title,
  rating,
  image,
  id,
  media_type,
  relese_date,
  className,
}: {
  title: string;
  rating: number;
  image: string;
  id: number;
  media_type: "movie" | "tv";
  relese_date: string | null;
  className?: string;
}) {
  const { watchlist, update } = useWatchList();

  const isOnWatchList = watchlist.some(
    (item) => item.externalId === id.toString()
  );

  function handleWatchList(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    update({
      title,
      type: media_type,
      externalId: id.toString(),
      image,
      rating: rating,
      releaseDate: relese_date ?? undefined,
    });
  }
  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={handleWatchList} className={cn(className)}>
            <Badge
              variant="secondary"
              className="size-9 p-2 hover:bg-secondary"
            >
              {isOnWatchList ? <Check size={24} /> : <Plus size={24} />}
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm font-medium">
            {" "}
            {isOnWatchList ? "Remove from Watchlist" : "Add to Watchlist"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
