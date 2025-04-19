import Dexie, { type Table } from "dexie";

export interface WatchlistItem {
  watchlist_id: string;
  user_id: string;
  title: string;
  type: "tv" | "movie";
  external_id: string;
  image: string;
  rating: number;
  release_date: string;
  updated_at: number;
  deleted: 0 | 1;
}

class WatchlistDB extends Dexie {
  watchlist!: Table<WatchlistItem>;

  constructor() {
    super("WatchlistDB");

    this.version(2).stores({
      watchlist:
        "watchlist_id, [user_id+deleted],[user_id+deleted+external_id], updated_at",
    });
  }
}

export const db = new WatchlistDB();
