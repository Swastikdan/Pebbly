import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { LOCAL_GUEST_USER_ID } from "@/constants";

export type WatchlistItem = {
  watchlist_id: string;
  user_id: string;
  title: string;
  type: "tv" | "movie";
  external_id: string;
  image: string;
  rating: number;
  release_date: string;
  updated_at: number;
};

interface WatchlistState {
  watchlist: WatchlistItem[];
  toggleWatchlistItem: (item: {
    title: string;
    rating: number;
    image: string;
    id: string;
    media_type: "tv" | "movie";
    release_date: string;
  }) => Promise<void>;
  setWatchlist: (newWatchlist: WatchlistItem[]) => void; // Added for import functionality
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      watchlist: [],

      toggleWatchlistItem: async (item) => {
        const currentWatchlist = get().watchlist;
        const existingIndex = currentWatchlist.findIndex(
          (wlItem) =>
            wlItem.user_id === LOCAL_GUEST_USER_ID &&
            wlItem.external_id === item.id
        );

        if (existingIndex !== -1) {
          const updatedWatchlist = currentWatchlist.filter(
            (_, index) => index !== existingIndex
          );
          set({ watchlist: updatedWatchlist });
        } else {
          const newItem: WatchlistItem = {
            watchlist_id: crypto.randomUUID(),
            user_id: LOCAL_GUEST_USER_ID,
            title: item.title,
            type: item.media_type,
            external_id: item.id,
            image: item.image,
            rating: item.rating,
            release_date: item.release_date,
            updated_at: Date.now(),
          };
          const updatedWatchlist = [newItem, ...currentWatchlist].sort(
            (a, b) => b.updated_at - a.updated_at
          );
          set({ watchlist: updatedWatchlist });
        }
      },

      // New action to replace the bulkPut functionality for imports
      setWatchlist: (newWatchlist: WatchlistItem[]) => {
        set({ watchlist: newWatchlist });
      },
    }),
    {
      name: "watchlist-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
