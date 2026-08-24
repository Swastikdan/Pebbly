import { useCallback, useEffect, useState } from "react";

import type { MediaType } from "@/lib/media-types";
import { Button } from "@/components/ui/button";
import {
  BookMarkFilledIcon,
  BookMarkIcon,
  TrashBin,
} from "@/components/ui/icons";
import {
  useToggleWatchlistItem,
  useWatchlistItem,
} from "@/hooks/use-watchlist";
import { cn } from "@/lib/utils";

interface WatchlistButtonProps {
  id: number;
  title: string;
  rating: number;
  image: string;
  media_type: MediaType;
  release_date: string | null;
  is_on_homepage?: boolean;
  is_on_watchlist_page?: boolean;
  className?: string;
  overview?: string;
  showLabel?: boolean;
}

const WatchlistButton = (props: WatchlistButtonProps) => {
  const {
    title,
    rating,
    image,
    media_type,
    release_date,
    is_on_watchlist_page,
    overview,
    showLabel,
  } = props;
  const itemId = String(props.id);
  const toggle = useToggleWatchlistItem();
  const { isOnWatchList } = useWatchlistItem(itemId, media_type);

  const [optimisticOn, setOptimisticOn] = useState<boolean | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (optimisticOn !== null && isOnWatchList === optimisticOn) {
      setOptimisticOn(null);
    }
  }, [isOnWatchList, optimisticOn]);

  const isActive = optimisticOn !== null ? optimisticOn : isOnWatchList;

  const showTrash = isActive && is_on_watchlist_page;

  const handleWatchList = useCallback(async () => {
    const nextActive = !isActive;
    setOptimisticOn(nextActive);

    if (!is_on_watchlist_page && nextActive) {
      setAnimKey((k) => k + 1);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 420);
    }

    try {
      await toggle(
        {
          title,
          rating,
          image,
          id: itemId,
          media_type,
          release_date: release_date ?? "",
          overview,
        },
        isOnWatchList,
      );
    } catch (error) {
      console.error("Error toggling watchlist:", error);
      setOptimisticOn(null);
    }
  }, [
    isActive,
    isOnWatchList,
    title,
    rating,
    image,
    itemId,
    media_type,
    release_date,
    toggle,
    overview,
    is_on_watchlist_page,
  ]);

  return (
    <Button
      variant={null}
      aria-label={isActive ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={isActive}
      size={showLabel ? "default" : "icon"}
      onClick={handleWatchList}
      data-active={isActive ? "true" : "false"}
      className={cn(
        "pressable relative shrink-0 rounded-xs shadow-md transition-colors duration-150",
        isActive && !is_on_watchlist_page
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 dark:hover:bg-primary/90 hover:text-primary-foreground dark:hover:text-primary-foreground border"
          : "border border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white dark:hover:bg-neutral-800 dark:hover:text-white",
        props.className,
      )}
    >
      {showTrash ? (
        <>
          <TrashBin
            className={cn("size-5", showLabel && "mr-1.5 size-3.5 sm:size-4")}
          />
          {showLabel && <span>Remove</span>}
        </>
      ) : isActive ? (
        <>
          <span
            key={animKey}
            className={cn(
              "flex items-center justify-center",
              isAnimating && "bookmark-pop",
              showLabel && "mr-1.5",
            )}
            style={{ display: "inline-flex" }}
          >
            <BookMarkFilledIcon
              className={cn("size-5", showLabel && "size-3.5 sm:size-4")}
            />
          </span>
          {showLabel && <span>Saved</span>}
        </>
      ) : (
        <>
          <BookMarkIcon
            className={cn("size-5", showLabel && "mr-1.5 size-3.5 sm:size-4")}
          />
          {showLabel && <span>Watchlist</span>}
        </>
      )}
    </Button>
  );
};

export { WatchlistButton };
