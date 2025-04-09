// db.ts
import Dexie, { type Table } from "dexie";

export interface WatchlistItem {
  watchlist_id: string; // Primary key
  user_id: string; // Foreign/user key
  title: string;
  type: "tv" | "movie";
  external_id: string;
  image: string;
  rating: number;
  release_date: string;
  updated_at: number; // Timestamp used for sync
  // Use numeric flag for deletion: 0 = active, 1 = deleted.
  deleted: 0 | 1;
}

class WatchlistDB extends Dexie {
  watchlist!: Table<WatchlistItem>;

  constructor() {
    super("WatchlistDB");
    // Define a compound index on user_id and deleted
    this.version(1).stores({
      // Compound index on [user_id+deleted]
      watchlist: "watchlist_id, [user_id+deleted], updated_at",
    });
  }
}

export const db = new WatchlistDB();
