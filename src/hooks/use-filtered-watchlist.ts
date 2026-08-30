import { useCallback, useDeferredValue, useMemo, useState } from "react";

import type { MediaType } from "@/domain/media";
import type { ProgressStatus, ReactionStatus } from "@/domain/watchlist";
import type { WatchlistItem } from "@/hooks/use-watchlist";

export type WatchlistFilter = "all" | ProgressStatus;
export type WatchlistMediaFilter = "all" | MediaType;
export type WatchlistSort = "recent" | "rating" | "title" | "year";
export type WatchlistReactionFilter = "all" | "none" | ReactionStatus;

export type WatchlistCounts = {
  all: number;
  "watch-later": number;
  watching: number;
  done: number;
  dropped: number;
};

export type WatchlistFiltersModel = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  activeFilter: WatchlistFilter;
  setActiveFilter: (filter: WatchlistFilter) => void;
  reactionFilter: WatchlistReactionFilter;
  setReactionFilter: (filter: WatchlistReactionFilter) => void;
  mediaFilter: WatchlistMediaFilter;
  setMediaFilter: (filter: WatchlistMediaFilter) => void;
  sortBy: WatchlistSort;
  setSortBy: (sort: WatchlistSort) => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  activeSecondaryCount: number;
  resetSecondaryFilters: () => void;
};

export function useFilteredWatchlist(watchlistData: WatchlistItem[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<WatchlistFilter>("watch-later");
  const [reactionFilter, setReactionFilter] =
    useState<WatchlistReactionFilter>("all");
  const [mediaFilter, setMediaFilter] = useState<WatchlistMediaFilter>("all");
  const [sortBy, setSortBy] = useState<WatchlistSort>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredWatchlist = useMemo(() => {
    let items = watchlistData;
    const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase();

    if (normalizedQuery) {
      items = items.filter((item) =>
        [item.title, item.overview, item.release_date]
          .filter(Boolean)
          .some((value) =>
            value?.toLocaleLowerCase().includes(normalizedQuery),
          ),
      );
    }

    if (activeFilter !== "all") {
      items = items.filter(
        (item) => (item.progressStatus ?? "watch-later") === activeFilter,
      );
    } else {
      items = items.filter((item) => item.progressStatus !== "dropped");
    }
    if (reactionFilter !== "all") {
      items = items.filter((item) =>
        reactionFilter === "none"
          ? item.reaction == null
          : item.reaction === reactionFilter,
      );
    }
    if (mediaFilter !== "all") {
      items = items.filter((item) => item.type === mediaFilter);
    }
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "title":
          return a.title.localeCompare(b.title);
        case "year":
          return (
            new Date(b.release_date || 0).getTime() -
            new Date(a.release_date || 0).getTime()
          );
        default:
          return (
            (b.created_at ?? b.updated_at ?? 0) -
            (a.created_at ?? a.updated_at ?? 0)
          );
      }
    });
  }, [
    watchlistData,
    deferredSearchQuery,
    activeFilter,
    reactionFilter,
    mediaFilter,
    sortBy,
  ]);

  const counts = useMemo(() => {
    const result = {
      all: 0,
      "watch-later": 0,
      watching: 0,
      done: 0,
      dropped: 0,
    };
    for (const item of watchlistData) {
      const status = item.progressStatus ?? "watch-later";
      if (status === "watch-later") result["watch-later"]++;
      else if (status === "watching") result.watching++;
      else if (status === "done") result.done++;
      else if (status === "dropped") result.dropped++;
      if (status !== "dropped") result.all++;
    }
    return result;
  }, [watchlistData]);

  const activeSecondaryCount = [
    searchQuery.trim().length > 0,
    mediaFilter !== "all",
    reactionFilter !== "all",
    sortBy !== "recent",
  ].filter(Boolean).length;

  const resetSecondaryFilters = useCallback(() => {
    setSearchQuery("");
    setMediaFilter("all");
    setReactionFilter("all");
    setSortBy("recent");
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    reactionFilter,
    setReactionFilter,
    mediaFilter,
    setMediaFilter,
    sortBy,
    setSortBy,
    filtersOpen,
    setFiltersOpen,
    activeSecondaryCount,
    resetSecondaryFilters,
    filteredWatchlist,
    counts,
  };
}
