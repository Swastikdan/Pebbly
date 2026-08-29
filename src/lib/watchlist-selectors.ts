import type { MediaType } from "@/domain/media";

/**
 * Pure watchlist derivations shared by every watchlist hook. They are the
 * (single) place where the map→filter→sort/find logic for media rows lives,
 * so the derivations can be table-tested without a React renderer.
 */

export type WatchlistRowLike = {
  updated_at: number;
  inWatchlist?: boolean;
};

export type MediaStateRowLike = {
  /** Guest/local state identity key. */
  external_id?: string;
  /** Remote (DB) identity key. */
  tmdbId?: number | null;
  type?: string;
  mediaType?: string;
};

/** Stable sort by most-recently-updated first. */
export function sortRowsByRecent<T extends WatchlistRowLike>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => b.updated_at - a.updated_at);
}

/** The rows that are currently in the watchlist, most-recent first. */
export function selectInWatchlist<T extends WatchlistRowLike>(rows: T[]): T[] {
  return sortRowsByRecent(rows.filter((row) => row.inWatchlist === true));
}

/**
 * Find a row by identity. Accepts either the local/guest shape
 * (`external_id` + `type`) or the remote/DB shape (`tmdbId` + `mediaType`),
 * so a single helper covers both branches the hooks used to hand-roll.
 */
export function findMediaState<T extends MediaStateRowLike>(
  rows: T[],
  id: string,
  mediaType: MediaType,
): T | undefined {
  const numericId = Number(id);
  return rows.find((row) => {
    const byRemoteId =
      typeof row.tmdbId === "number" &&
      row.tmdbId === numericId &&
      row.mediaType === mediaType;
    const byLocalId =
      row.external_id != null &&
      String(row.external_id) === id &&
      row.type === mediaType;
    return byRemoteId || byLocalId;
  });
}
