"use client";
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type WatchlistItem } from "@/db";
import { LOCAL_GUEST_USER_ID } from "@/constants";

export function useWatchlist() {
  // Remove the default value so we can detect if the query is still loading.
  const watchlist = useLiveQuery(
    () =>
      db.watchlist
        .where("[user_id+deleted]")
        .equals([LOCAL_GUEST_USER_ID, 0])
        .sortBy("updated_at")
        .then((entries) => entries.reverse()),
    [],
  );

  // If watchlist is undefined, the query hasn't returned yet.
  const loading = watchlist === undefined;

  const toggleWatchlistItem = useCallback(
    async (item: {
      title: string;
      rating: number;
      image: string;
      id: string;
      media_type: "tv" | "movie";
      release_date: string;
    }) => {
      // Use the compound index to check if the item exists and is active.
      const existing = await db.watchlist
        .where("[user_id+deleted]")
        .equals([LOCAL_GUEST_USER_ID, 0])
        .and((entry) => entry.external_id === item.id)
        .first();

      if (existing) {
        // Soft delete the item: set deleted flag to 1.
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
      // No need to manually refresh: useLiveQuery updates automatically.
    },
    [],
  );

  return { watchlist: watchlist ?? [], loading, toggleWatchlistItem };
}
