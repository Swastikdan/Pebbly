import Dexie, { type Table } from 'dexie';

export interface WatchlistItem {
  watchlist_id: string; // Primary key
  user_id: string; // Foreign/user key
  title: string;
  type: 'tv' | 'movie';
  external_id: string;
  image: string;
  rating: number;
  release_date: string;
  updated_at: number; // Timestamp used for sync
  deleted?: boolean; // For soft deletes
}

class WatchlistDB extends Dexie {
  watchlist!: Table<WatchlistItem>;

  constructor() {
    super('WatchlistDB');
    this.version(1).stores({
      // Primary key: watchlist_id
      // Indexed fields: user_id, updated_at, deleted
      watchlist: 'watchlist_id, user_id, updated_at, deleted',
    });
  }
}

export const db = new WatchlistDB();
