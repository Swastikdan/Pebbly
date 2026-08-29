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

export interface MediaMetadata {
  title?: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
}

export type WatchlistItemKey = `${MediaType}:${number}`;
