import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type WatchlistItem } from "@/db";
import { LOCAL_GUEST_USER_ID } from "@/constants";

/**
 * Toggle a watchlist item (add or remove) by performing a hard delete if it exists,
 * or adding it if it doesn't.
 */
export function useToggleWatchlistItem() {
  return useCallback(
    async (item: {
      title: string;
      rating: number;
      image: string;
      id: string;
      media_type: "tv" | "movie";
      release_date: string;
    }) => {
      const existing = await db.watchlist
        .where({ user_id: LOCAL_GUEST_USER_ID, external_id: item.id })
        .first();

      if (existing) {
        // If the item exists, delete it from the database
        await db.watchlist.delete(existing.watchlist_id);
      } else {
        // If the item does not exist, add it to the watchlist
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
          // 'deleted' field is no longer needed
        };
        await db.watchlist.add(newItem);
      }
    },
    [],
  );
}

/**
 * Subscribe to a single watchlist item by ID.
 * Only the component using this hook will rerender when this item's state changes.
 */
export function useWatchlistItem(id: string) {
  const item = useLiveQuery(
    () =>
      db.watchlist
        .where({ user_id: LOCAL_GUEST_USER_ID, external_id: id }) // Query without 'deleted'
        .first(),
    [id],
  );

  return {
    isOnWatchList: !!item,
  };
}

/**
 * Subscribe to the entire watchlist for the local guest user.
 */
export function useWatchlist() {
  const watchlist = useLiveQuery(
    () =>
      db.watchlist
        .where("user_id")
        .equals(LOCAL_GUEST_USER_ID)
        .reverse()
        .sortBy("updated_at"),
    [],
  );

  return { watchlist: watchlist ?? [], loading: watchlist === undefined };
}
