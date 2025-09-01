"use client";

import { Button } from "@heroui/button";
import { useCallback } from "react";
import { Tooltip } from "@heroui/tooltip";

import { useToggleWatchlistItem, useWatchlistItem } from "@/hooks/usewatchlist";

import { BookMarkFilledIcon, BookMarkIcon } from "./icons";

interface WatchListButtonProps {
  title: string;
  rating: number;
  image: string;
  id: number;
  media_type: "movie" | "tv";
  release_date: string | null;
  is_on_homepage?: boolean;
  is_on_watchlist_page?: boolean;
  className?: string;
}

export function WatchlistButton({
  title,
  rating,
  image,
  id,
  media_type,
  release_date,
  className,
}: WatchListButtonProps) {
  const itemId = String(id);
  const toggle = useToggleWatchlistItem();
  const { isOnWatchList } = useWatchlistItem(itemId);

  const handleWatchList = useCallback(async () => {
    try {
      await toggle({
        title,
        rating,
        image,
        id: itemId,
        media_type,
        release_date: release_date ?? "",
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error toggling watchlist:", error);
    }
  }, [title, rating, image, itemId, media_type, release_date, toggle]);

  return (
    <div className={className}>
      <Tooltip
        content={
          <div className="px-1 py-2">
            <div className="">
              {isOnWatchList ? "Remove from watchlist" : "Add to watchlist"}
            </div>
          </div>
        }
        delay={0}
      >
        <Button
          isIconOnly
          aria-label={
            isOnWatchList ? "Remove from watchlist" : "Add to watchlist"
          }
          startContent={
            isOnWatchList ? (
              <BookMarkFilledIcon className="size-5" />
            ) : (
              <BookMarkIcon className="size-5" />
            )
          }
          variant="faded"
          onPress={handleWatchList}
        />
      </Tooltip>
    </div>
  );
}
