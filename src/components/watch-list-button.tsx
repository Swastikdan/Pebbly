"use client";
import React, { useCallback } from "react";
import { useToggleWatchlistItem, useWatchlistItem } from "@/hooks/usewatchlist";
import { Plus, Check, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface WatchListButtonProps {
  title: string;
  rating: number;
  image: string;
  id: number;
  media_type: "movie" | "tv";
  relese_date: string | null;
  is_on_watchlist_page?: boolean;
  className?: string;
}

export default function WatchListButton({
  title,
  rating,
  image,
  id,
  media_type,
  relese_date,
  is_on_watchlist_page = false,
  className,
}: WatchListButtonProps) {
  const itemId = String(id);
  const toggle = useToggleWatchlistItem();
  const { isOnWatchList } = useWatchlistItem(itemId);

  const handleWatchList = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      toggle({
        title,
        rating,
        image,
        id: itemId,
        media_type,
        release_date: relese_date ?? "",
      }).catch((error) => {
        console.error(error);
      });
    },
    [title, rating, image, itemId, media_type, relese_date, toggle],
  );

  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="default"
            className={cn(
              className,
              "bg-primary-foreground dark:bg-primary text-secondary-foreground dark:text-primary-foreground z-20 cursor-pointer p-2 [&>svg]:size-4",
            )}
            aria-label={
              is_on_watchlist_page || isOnWatchList
                ? "Remove from watchlist"
                : "Add to watchlist"
            }
            role="button"
            onClick={handleWatchList}
          >
            {is_on_watchlist_page ? (
              <Trash2 size={24} />
            ) : isOnWatchList ? (
              <Check size={24} />
            ) : (
              <Plus size={24} />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="cursor-none select-none">
          <p className="text-sm font-light">
            {is_on_watchlist_page
              ? "Remove from Watchlist"
              : isOnWatchList
                ? "Remove from Watchlist"
                : "Add to Watchlist"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
