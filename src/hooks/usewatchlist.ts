import { useCallback } from "react";
import { useWatchlistStore } from "@/store/usewatchliststore";

export function useToggleWatchlistItem() {
  // The actual toggle logic is now within the Zustand store action
  const toggle = useWatchlistStore((state) => state.toggleWatchlistItem);
  return useCallback(
    async (item: {
      title: string;
      rating: number;
      image: string;
      id: string;
      media_type: "tv" | "movie";
      release_date: string;
    }) => {
      await toggle(item);
    },
    [toggle],
  );
}

export function useWatchlistItem(id: string) {
  const isOnWatchList = useWatchlistStore(
    useCallback(
      (state) => state.watchlist.some((item) => item.external_id === id),
      [id],
    ),
  );

  return {
    isOnWatchList,
  };
}

// Subscribe to the entire watchlist for the local guest user from the Zustand store.
export function useWatchlist() {
  const watchlist = useWatchlistStore((state) => state.watchlist);
  const loading = false;

  return { watchlist, loading };
}
