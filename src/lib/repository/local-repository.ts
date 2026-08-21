import type { QueryClient } from "@tanstack/react-query";
import { useLocalListsStore } from "@/hooks/use-local-lists-store";
import { useLocalProgressStore } from "@/hooks/use-local-progress-store";
import { watchlistOptimistic } from "@/hooks/watchlist/watchlist-optimistic";
import { useWatchlistStore } from "@/hooks/watchlist-store";
import { getTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import {
	type ListsRepository,
	type Repository,
	resolveProgressStatusAction,
	type WatchlistRepository,
} from "./types";

function logLocalError(action: string, error: unknown) {
	console.error(`Failed to ${action}`, error);
}

export function createLocalRepository(queryClient: QueryClient): Repository {
	const watchlist: WatchlistRepository = {
		async toggleMembership(item, inWatchlist) {
			useWatchlistStore
				.getState()
				.setWatchlistMembershipLocal(item.id, item.media_type, inWatchlist, {
					title: item.title,
					image: item.image,
					rating: item.rating,
					release_date: item.release_date,
					overview: item.overview,
				});
		},

		async batchToggleMembership(items) {
			const setLocal = useWatchlistStore.getState().setWatchlistMembershipLocal;
			for (const item of items) {
				setLocal(item.id, item.media_type, item.inWatchlist, {
					title: item.title,
					image: item.image,
					rating: item.rating,
					release_date: item.release_date,
					overview: item.overview,
				});
			}
		},

		setProgressStatus(id, mediaType, progressStatus, metadata, currentStatus) {
			const action = resolveProgressStatusAction(
				mediaType,
				progressStatus,
				currentStatus,
			);
			const setLocalStatus =
				useWatchlistStore.getState().setProgressStatusLocal;

			if (action.type === "tv") {
				setLocalStatus(
					id,
					mediaType,
					progressStatus,
					action.progress,
					metadata,
				);

				if (action.isLeavingCompletion && !action.shouldMarkWatched) {
					useLocalProgressStore.getState().clearShowProgress(Number(id));
				} else if (action.needsEpisodeUpdate) {
					queryClient
						.ensureQueryData({
							queryKey: queryKeys.tmdb.tvDetails(Number(id)),
							queryFn: () => getTvDetails({ id: Number(id) }),
						})
						.then((details) => {
							const { markSeasonWatched } = useLocalProgressStore.getState();
							for (const season of watchlistOptimistic.buildSeasonEpisodeSelections(
								details,
							)) {
								markSeasonWatched(
									Number(id),
									season.season,
									season.episodes,
									action.shouldMarkWatched,
								);
							}
						})
						.catch((error) =>
							logLocalError("sync local show episode status", error),
						);
				}
				return;
			}

			setLocalStatus(id, mediaType, progressStatus, undefined, metadata);
		},

		setReaction(id, mediaType, reaction, metadata) {
			useWatchlistStore
				.getState()
				.setReactionLocal(id, mediaType, reaction, metadata);
		},

		async markEpisode(args) {
			useLocalProgressStore
				.getState()
				.markEpisodeWatched(
					args.tmdbId,
					args.season,
					args.episode,
					args.isWatched,
				);
		},

		async markSeason(args) {
			useLocalProgressStore
				.getState()
				.markSeasonWatched(
					args.tmdbId,
					args.season,
					args.episodes,
					args.isWatched,
				);
		},

		async updateProgress(args) {
			const metadata = {
				title: args.title,
				image: args.image,
				rating: args.rating,
				release_date: args.release_date,
				overview: args.overview,
			};
			if (args.progressStatus !== undefined) {
				useWatchlistStore
					.getState()
					.setProgressStatusLocal(
						String(args.tmdbId),
						args.mediaType,
						args.progressStatus,
						args.progress ?? 0,
						metadata,
					);
				return;
			}
			useWatchlistStore
				.getState()
				.setProgressLocal(
					String(args.tmdbId),
					args.mediaType,
					args.progress ?? 0,
					metadata,
				);
		},

		async removeFromContinueWatching(tmdbId, mediaType) {
			useWatchlistStore
				.getState()
				.setProgressStatusLocal(String(tmdbId), mediaType, "watch-later", 0);
			useLocalProgressStore.getState().clearShowProgress(tmdbId);
		},
	};

	const lists: ListsRepository = {
		async deleteList(listId) {
			useLocalListsStore.getState().deleteList(listId);
		},

		async createList(args) {
			return useLocalListsStore
				.getState()
				.createList(
					args.name,
					args.color,
					args.visibility,
					args.listType,
					args.description,
					args.sortType,
				);
		},

		async createListAndAddItem(args) {
			useLocalListsStore.getState().createListAndAddItem(args);
		},

		async updateList(args) {
			useLocalListsStore
				.getState()
				.updateList(
					args.listId,
					args.name,
					args.color,
					args.visibility,
					args.listType,
					args.description,
					args.sortType,
				);
		},

		async toggleListItem(args) {
			return useLocalListsStore.getState().toggleListItem(args);
		},

		async reorderListItem(args) {
			useLocalListsStore
				.getState()
				.reorderListItem(args.listId, args.orderedItems);
		},

		async cloneList(sourceListId) {
			return useLocalListsStore.getState().cloneList(sourceListId);
		},
	};

	return { ...watchlist, ...lists };
}
