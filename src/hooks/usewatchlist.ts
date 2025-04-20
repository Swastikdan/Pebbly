"use client";
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type WatchlistItem } from "@/db";
import { LOCAL_GUEST_USER_ID } from "@/constants";

/**
 * Toggle a watchlist item (add or remove) without subscribing to entire list changes.
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
        .where("[user_id+deleted+external_id]")
        .equals([LOCAL_GUEST_USER_ID, 0, item.id])
        .first();

      if (existing) {
        await db.watchlist.update(existing.watchlist_id, {
          deleted: 1,
          updated_at: Date.now(),
        });
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
          deleted: 0,
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
        .where("[user_id+deleted+external_id]")
        .equals([LOCAL_GUEST_USER_ID, 0, id])
        .first(),
    [id],
  );

  return {
    isOnWatchList: !!item,
  };
}

export function useWatchlist() {
  const watchlist = useLiveQuery(
    () =>
      db.watchlist
        .where("[user_id+deleted]")
        .equals([LOCAL_GUEST_USER_ID, 0])
        .sortBy("updated_at")
        .then((entries) => entries.reverse()),
    [],
  );

  return { watchlist: watchlist ?? [], loading: watchlist === undefined };
}
