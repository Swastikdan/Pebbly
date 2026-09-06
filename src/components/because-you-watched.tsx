"use client";

import { ChevronDown } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { WatchlistItem } from "@/hooks/use-watchlist";
import { MediaCard } from "@/components/media-card";
import { MediaSkeletonList } from "@/components/media-skeleton-list";
import { ScrollContainer } from "@/components/scroll-container";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { useAllMediaStates } from "@/hooks/use-watchlist";
import {
  getMovieRecommendations,
  getTvSeriesRecommendations,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

function getItemKey(item: WatchlistItem): string {
  return `${item.type}:${item.external_id}`;
}

export const BecauseYouWatched = memo(function BecauseYouWatched() {
  const { allMediaStates, loading: isWatchlistLoading } = useAllMediaStates();
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>("");

  // Deduplicate and filter items that have valid title and ID
  const watchedItems = useMemo(() => {
    const seen = new Set<string>();
    const validItems: WatchlistItem[] = [];

    for (const item of allMediaStates) {
      if (!item.title || !item.external_id) continue;
      const key = getItemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      validItems.push(item);
    }

    // Sort to prioritize items marked as done or watching, then by updated_at
    return validItems.sort((a, b) => {
      const aWatched =
        a.progressStatus === "done" || a.progressStatus === "watching";
      const bWatched =
        b.progressStatus === "done" || b.progressStatus === "watching";
      if (aWatched && !bWatched) return -1;
      if (!aWatched && bWatched) return 1;
      return (b.updated_at ?? 0) - (a.updated_at ?? 0);
    });
  }, [allMediaStates]);

  // Set default selected item
  useEffect(() => {
    if (watchedItems.length === 0) return;
    if (
      !selectedKey ||
      !watchedItems.some((i) => getItemKey(i) === selectedKey)
    ) {
      setSelectedKey(getItemKey(watchedItems[0]));
    }
  }, [watchedItems, selectedKey]);

  const selectedItem = useMemo(() => {
    if (watchedItems.length === 0) return null;
    return (
      watchedItems.find((i) => getItemKey(i) === selectedKey) ?? watchedItems[0]
    );
  }, [watchedItems, selectedKey]);

  // Query TMDB recommendations for the chosen title
  const mediaId = selectedItem ? Number(selectedItem.external_id) : 0;
  const isMovie = selectedItem?.type === "movie";

  const { data: movieData, isLoading: isMovieLoading } = useQuery({
    queryKey: queryKeys.tmdb.recommendations("movie", mediaId),
    queryFn: () => getMovieRecommendations({ id: mediaId }),
    enabled: isMovie && !!mediaId && Number.isFinite(mediaId),
    staleTime: 1000 * 60 * 15,
  });

  const { data: tvData, isLoading: isTvLoading } = useQuery({
    queryKey: queryKeys.tmdb.recommendations("tv", mediaId),
    queryFn: () => getTvSeriesRecommendations({ id: mediaId }),
    enabled: !isMovie && !!mediaId && Number.isFinite(mediaId),
    staleTime: 1000 * 60 * 15,
  });

  const isRecLoading = isMovie ? isMovieLoading : isTvLoading;
  const hasRecommendations = isMovie
    ? (movieData?.results?.length ?? 0) > 0
    : (tvData?.results?.length ?? 0) > 0;

  if (isWatchlistLoading && !selectedItem) {
    return (
      <section className="w-full space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-h2">Because you watched</h2>
        </div>
        <MediaSkeletonList cardType="horizontal" count={6} />
      </section>
    );
  }

  if (!selectedItem || watchedItems.length === 0) {
    return null;
  }

  return (
    <section className="w-full space-y-4">
      <div className="flex w-full min-w-0 items-baseline gap-1.5 sm:gap-2">
        <span className="text-h2 shrink-0 font-semibold whitespace-nowrap">
          Because you watched
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className="group text-h2 text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-w-0 shrink cursor-pointer items-baseline gap-1 text-start font-bold outline-hidden transition-colors focus-visible:ring-2"
            title="Choose another title from your watch history"
            aria-label={`Because you watched ${selectedItem.title}. Click to choose another title.`}
          >
            <span className="border-muted-foreground/60 group-hover:border-foreground min-w-0 truncate border-b-2 pb-0.5 transition-colors">
              {selectedItem.title}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "text-muted-foreground/70 group-hover:text-foreground size-4 shrink-0 self-center transition-transform duration-200 sm:size-5",
                open && "rotate-180",
              )}
            />
          </PopoverTrigger>

          <PopoverPopup
            sideOffset={8}
            align="start"
            className="max-h-72 w-64 flex-col overflow-hidden p-1 sm:w-72"
          >
            <ul
              aria-label="Watched titles list"
              className="max-h-64 flex-1 list-none space-y-0.5 overflow-y-auto p-0.5"
            >
              {watchedItems.map((item) => {
                const key = getItemKey(item);
                const isSelected = key === selectedKey;

                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKey(key);
                        setOpen(false);
                      }}
                      className={cn(
                        "block w-full cursor-pointer truncate rounded-md px-3 py-2 text-start text-xs outline-hidden transition-colors select-none",
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-accent text-foreground hover:text-accent-foreground",
                      )}
                    >
                      {item.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverPopup>
        </Popover>
      </div>

      {isRecLoading ? (
        <MediaSkeletonList cardType="horizontal" count={6} />
      ) : !hasRecommendations ? (
        <div className="border-border/70 bg-card/40 rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            No recommendations available for &ldquo;{selectedItem.title}&rdquo;.
          </p>
          <p className="text-muted-foreground/70 mt-1.5 text-xs">
            Click the title above to choose another movie or series from your
            watch history.
          </p>
        </div>
      ) : (
        <ScrollContainer isButtonsVisible={true}>
          <div className="flex gap-2 p-4 first:ps-0 last:pe-0">
            {isMovie
              ? movieData?.results?.map((item) => (
                  <MediaCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    rating={item.vote_average}
                    image={item.poster_path ?? ""}
                    poster_path={item.poster_path}
                    media_type="movie"
                    release_date={item.release_date}
                    card_type="horizontal"
                    overview={item.overview}
                    is_on_homepage={true}
                  />
                ))
              : tvData?.results?.map((item) => (
                  <MediaCard
                    key={item.id}
                    id={item.id}
                    title={item.name}
                    rating={item.vote_average}
                    image={item.poster_path ?? ""}
                    poster_path={item.poster_path}
                    media_type="tv"
                    release_date={item.first_air_date}
                    card_type="horizontal"
                    overview={item.overview}
                    is_on_homepage={true}
                  />
                ))}
          </div>
        </ScrollContainer>
      )}
    </section>
  );
});
