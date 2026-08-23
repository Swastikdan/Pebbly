import type {
	CreateListAndAddArgs,
	CreateListArgs,
	ToggleListItemArgs,
	UpdateListArgs,
} from "@/hooks/custom-lists/list-optimistic";
import type { MediaMetadata, MediaType } from "@/hooks/watchlist-store";
import type { ProgressStatus, ReactionStatus } from "@/types";

/**
 * Repository abstraction over the remote backend (server fns + optimistic ops)
 * and the local fallback (Zustand stores). Mutation hooks select an
 * implementation via `useRepository()` based on auth state, so callers never
 * branch on `isSignedIn` themselves.
 */

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
	/** Flip (or force) watchlist membership for a single title. */
	toggleMembership(
		item: WatchlistToggleItem,
		inWatchlist: boolean,
	): Promise<void>;
	/** Update progress status; for TV shows also syncs episode state. */
	setProgressStatus(
		id: string,
		mediaType: MediaType,
		progressStatus: ProgressStatus,
		metadata?: MediaMetadata,
		currentStatus?: ProgressStatus | null,
	): void;
	/** Set or clear the reaction on a watched title. */
	setReaction(
		id: string,
		mediaType: MediaType,
		reaction: ReactionStatus | null,
		metadata?: MediaMetadata,
	): void;
	/** Toggle one episode's watched state. */
	markEpisode(args: MarkEpisodeArgs): Promise<void>;
	/** Toggle a whole season's episodes' watched state. */
	markSeason(args: MarkSeasonArgs): Promise<void>;
	/** Persist playback progress (percent) for a title. */
	updateProgress(args: UpdateProgressArgs): Promise<void>;
	/** Clear watching state so a title leaves "continue watching". */
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
	/** Create a list; resolves with the created list's id. */
	createList(args: CreateListArgs): Promise<string>;
	createListAndAddItem(args: CreateListAndAddArgs): Promise<void>;
	updateList(args: UpdateListArgs): Promise<void>;
	/** Toggle membership; resolves true when the item was added, false when removed. */
	toggleListItem(args: ToggleListItemArgs): Promise<boolean>;
	/** Persist a new order for a list's items (ranked lists). */
	reorderListItem(args: ReorderListItemsRepoArgs): Promise<void>;
	/** Clone a list (own or public); resolves with the clone's id. */
	cloneList(sourceListId: string): Promise<string>;
}

export type Repository = WatchlistRepository & ListsRepository;

/** Shared decision tree for progress-status writes (TV vs movie). */
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
