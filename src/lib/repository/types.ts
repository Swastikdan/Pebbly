import type {
  CreateListAndAddArgs,
  CreateListArgs,
  ToggleListItemArgs,
  UpdateListArgs,
} from "@/lib/data/optimistic/list-optimistic";
import type { MediaMetadata, MediaType } from "@/stores/watchlist-store";
import type { ProgressStatus, ReactionStatus } from "@/types";

export interface WatchlistToggleItem {
  title: string;
  rating: number;
  image: string;
  id: string;
  media_type: MediaType;
  release_date: string;
  overview?: string;
}

export type MarkEpisodeArgs = {
  tmdbId: number;
  season: number;
  episode: number;
  isWatched: boolean;
};

export type MarkSeasonArgs = {
  tmdbId: number;
  season: number;
  episodes: number[];
  isWatched: boolean;
};

export type UpdateProgressArgs = {
  tmdbId: number;
  mediaType: MediaType;
  progress?: number;
  /**
   * When set, persists the status alongside progress without any of the
   * episode-row side effects of `setProgressStatus` (used by background
   * derivation, not explicit user actions).
   */
  progressStatus?: ProgressStatus;
  title?: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

export interface WatchlistRepository {
  toggleMembership(
    item: WatchlistToggleItem,
    inWatchlist: boolean,
  ): Promise<void>;
  setProgressStatus(
    id: string,
    mediaType: MediaType,
    progressStatus: ProgressStatus,
    metadata?: MediaMetadata,
    currentStatus?: ProgressStatus | null,
    progress?: number,
  ): void;
  setReaction(
    id: string,
    mediaType: MediaType,
    reaction: ReactionStatus | null,
    metadata?: MediaMetadata,
  ): void;
  markEpisode(args: MarkEpisodeArgs): Promise<void>;
  markSeason(args: MarkSeasonArgs): Promise<void>;
  updateProgress(args: UpdateProgressArgs): Promise<void>;
  removeFromContinueWatching(
    tmdbId: number,
    mediaType: MediaType,
  ): Promise<void>;
}

export type ReorderListItemsRepoArgs = {
  listId: string;
  orderedItems: Array<{ tmdbId: number; mediaType: MediaType }>;
};

export interface ListsRepository {
  deleteList(listId: string): Promise<void>;
  createList(args: CreateListArgs): Promise<string>;
  createListAndAddItem(args: CreateListAndAddArgs): Promise<void>;
  updateList(args: UpdateListArgs): Promise<void>;
  toggleListItem(args: ToggleListItemArgs): Promise<boolean>;
  reorderListItem(args: ReorderListItemsRepoArgs): Promise<void>;
  cloneList(sourceListId: string): Promise<string>;
}

export type Repository = WatchlistRepository & ListsRepository;

export type ProgressStatusAction =
  | { type: "movie"; progress: undefined }
  | {
      type: "tv";
      shouldMarkWatched: boolean;
      isLeavingCompletion: boolean;
      needsEpisodeUpdate: boolean;
      progress: number | undefined;
    };

export function resolveProgressStatusAction(
  mediaType: MediaType,
  progressStatus: ProgressStatus,
  currentStatus?: ProgressStatus | null,
): ProgressStatusAction {
  if (mediaType !== "tv") {
    return { type: "movie", progress: undefined };
  }

  const shouldMarkWatched = progressStatus === "done";
  const isLeavingCompletion = currentStatus === "done" && !shouldMarkWatched;
  const needsEpisodeUpdate =
    shouldMarkWatched ||
    progressStatus === "watch-later" ||
    isLeavingCompletion;

  const progress =
    progressStatus === "done"
      ? 100
      : progressStatus === "watch-later" || isLeavingCompletion
        ? 0
        : undefined;

  return {
    type: "tv",
    shouldMarkWatched,
    isLeavingCompletion,
    needsEpisodeUpdate,
    progress,
  };
}
