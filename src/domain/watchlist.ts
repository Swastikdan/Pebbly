import type { MediaType } from "./media";

export type { MediaType };

export const PROGRESS_STATUSES = [
  "watch-later",
  "watching",
  "done",
  "dropped",
] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const REACTIONS = [
  "loved",
  "liked",
  "mixed",
  "not-for-me",
  "recommended",
] as const;
export type ReactionStatus = (typeof REACTIONS)[number];

// Fields tolerate `null` (not just `undefined`) so the same shape covers both
// the client-side metadata builders and the nullable server/DB write paths.
export interface MediaMetadata {
  title?: string | null;
  image?: string | null;
  rating?: number | null;
  release_date?: string | null;
  overview?: string | null;
}

export type WatchlistItemKey = `${MediaType}:${number}`;
