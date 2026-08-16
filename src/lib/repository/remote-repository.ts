import type { QueryClient } from "@tanstack/react-query";
import {
	applyToggleInverse,
	beginCreateListAndAddOp,
	beginCreateListOp,
	beginDeleteListOp,
	beginToggleListItemOp,
	beginUpdateListOp,
	swapListId,
} from "@/hooks/custom-lists/list-optimistic";
import {
	applyServerState,
	type OpHandle,
	scheduleSync,
} from "@/hooks/pending-ops";
import {
	type MarkShowEpisodesAndStatusArgs,
	type ProgressStatusArgs,
	type SetReactionArgs,
	type WatchlistMembershipArgs,
	watchlistOptimistic,
} from "@/hooks/watchlist/watchlist-optimistic";
import { createBatcher } from "@/lib/batcher";
import { getTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import type { WatchItemRow } from "@/lib/server-types";
import {
	createCustomList,
	createCustomListAndAddItem,
	deleteCustomList,
	toggleListItem,
	updateCustomList,
} from "@/server/fns/lists";
import {
	batchSetWatchlistMembership,
	markShowEpisodesAndStatus,
	setProgressStatus as setProgressStatusFn,
	setReaction as setReactionFn,
	setWatchlistMembership,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import {
	type ListsRepository,
	type Repository,
	resolveProgressStatusAction,
	type WatchlistRepository,
} from "./types";

function logWatchlistError(action: string, error: unknown) {
	console.error(`Failed to ${action}`, error);
}

/**
 * Run a server write through the optimistic journal: begin the op, resolve on
 * success, roll back on failure, and always schedule a background sync. This
 * replicates the `useMutation` lifecycle (onMutate/onSuccess/onError/onSettled)
 * imperatively so the repository does not depend on hooks.
 */
function runJournaledMutation(
	queryClient: QueryClient,
	{
		begin,
		run,
		syncKeys,
		errorMessage,
	}: {
		begin: () => OpHandle | undefined;
		run: () => Promise<unknown>;
		syncKeys: readonly (readonly unknown[])[];
		errorMessage: string;
	},
) {
	const handle = begin();
	run()
		.then(() => handle?.resolve())
		.catch((error) => {
			logWatchlistError(errorMessage, error);
			handle?.remove();
		})
		.finally(() => scheduleSync(queryClient, syncKeys));
}

type BatchedWatchlistMembershipTask = {
	args: WatchlistMembershipArgs;
	handle?: OpHandle;
	queryClient: QueryClient;
};

const watchlistMembershipBatcher = createBatcher<
	BatchedWatchlistMembershipTask,
	WatchItemRow
>(
	async (tasks) => {
		const queryClient = tasks[0]?.queryClient;
		const items = tasks.map((t) => t.args);

		try {
			let rows: WatchItemRow[];
			if (items.length === 1) {
				const row = await unwrap(setWatchlistMembership({ data: items[0] }));
				rows = row ? [row] : [];
			} else {
				rows = await unwrap(batchSetWatchlistMembership({ data: { items } }));
			}

			// Merge the authoritative rows into the cache (no full refetch — the
			// server response already reflects this batch). Touched items missing
			// from the response were deleted.
			if (queryClient) {
				applyServerState(
					queryClient,
					queryKeys.watchlist.list(),
					rows,
					items.map((i) => `${i.mediaType}:${i.tmdbId}`),
				);
			}
			for (const task of tasks) {
				task.handle?.resolve();
			}
			// The tracked-ids query derives from the watchlist, so keep it fresh.
			if (queryClient) {
				scheduleSync(queryClient, [queryKeys.watchlist.trackedTmdbIds()]);
			}
			return rows;
		} catch (error) {
			logWatchlistError("batch set watchlist membership", error);
			for (const task of tasks) {
				task.handle?.remove();
			}
			// The server may have applied part of the batch before failing; a
			// refresh reconciles the cache with the authoritative state.
			if (queryClient) {
				scheduleSync(queryClient, [queryKeys.watchlist.list()]);
			}
			throw error;
		}
	},
	{
		delayMs: 300,
		maxWaitMs: 1200,
		maxBatchSize: 100,
		getKey: (task) => `${task.args.mediaType}:${task.args.tmdbId}`,
		// Don't lose queued membership writes if the page unloads mid-debounce.
		flushOnPageHide: true,
	},
);

export function createRemoteRepository(
	queryClient: QueryClient,
	userId: string | undefined,
): Repository {
	const watchlist: WatchlistRepository = {
		async toggleMembership(item, inWatchlist) {
			const args: WatchlistMembershipArgs = {
				tmdbId: Number(item.id),
				mediaType: item.media_type,
				inWatchlist,
				title: item.title,
				image: item.image,
				rating: item.rating,
				release_date: item.release_date || undefined,
				overview: item.overview || undefined,
			};

			const handle = watchlistOptimistic.beginMembershipOp(queryClient, args);
			await watchlistMembershipBatcher.schedule({
				args,
				handle,
				queryClient,
			});
		},

		async batchToggleMembership(items) {
			if (items.length === 0) return;

			const argsList: WatchlistMembershipArgs[] = items.map((item) => ({
				tmdbId: Number(item.id),
				mediaType: item.media_type,
				inWatchlist: item.inWatchlist,
				title: item.title,
				image: item.image,
				rating: item.rating,
				release_date: item.release_date || undefined,
				overview: item.overview || undefined,
			}));
			// One optimistic transaction for the whole batch: a single handle
			// is shared by every task so a failure rolls everything back
			// together instead of leaving per-item patches in flight.
			const handle = watchlistOptimistic.beginMembershipBatchOp(
				queryClient,
				argsList,
			);
			const tasks: BatchedWatchlistMembershipTask[] = argsList.map((args) => ({
				args,
				handle,
				queryClient,
			}));

			await Promise.all(
				tasks.map((task) => watchlistMembershipBatcher.schedule(task)),
			);
		},

		setProgressStatus(id, mediaType, progressStatus, metadata, currentStatus) {
			const action = resolveProgressStatusAction(
				mediaType,
				progressStatus,
				currentStatus,
			);

			if (action.type === "tv") {
				const baseArgs: MarkShowEpisodesAndStatusArgs = {
					tmdbId: Number(id),
					mediaType,
					seasons: [],
					isWatched: false,
					progressStatus,
					progress: action.progress,
					title: metadata?.title,
					image: metadata?.image,
					rating: metadata?.rating,
					release_date: metadata?.release_date,
					overview: metadata?.overview,
				};
				if (action.isLeavingCompletion && !action.shouldMarkWatched) {
					runJournaledMutation(queryClient, {
						begin: () =>
							watchlistOptimistic.beginMarkShowOp(queryClient, {
								...baseArgs,
								clearAllEpisodes: true,
							}),
						run: () =>
							unwrap(
								markShowEpisodesAndStatus({
									data: { ...baseArgs, clearAllEpisodes: true },
								}),
							),
						syncKeys: [
							queryKeys.watchlist.list(),
							queryKeys.watchlist.episodes(Number(id)),
						],
						errorMessage: "sync show episode status",
					});
				} else if (action.needsEpisodeUpdate) {
					queryClient
						.ensureQueryData({
							queryKey: ["tv", Number(id)],
							queryFn: () => getTvDetails({ id: Number(id) }),
						})
						.then((details) => {
							const seasons =
								watchlistOptimistic.buildSeasonEpisodeSelections(details);
							runJournaledMutation(queryClient, {
								begin: () =>
									watchlistOptimistic.beginMarkShowOp(queryClient, {
										...baseArgs,
										seasons,
										isWatched: action.shouldMarkWatched,
									}),
								run: () =>
									unwrap(
										markShowEpisodesAndStatus({
											data: {
												...baseArgs,
												seasons,
												isWatched: action.shouldMarkWatched,
											},
										}),
									),
								syncKeys: [
									queryKeys.watchlist.list(),
									queryKeys.watchlist.episodes(Number(id)),
								],
								errorMessage: "sync show episode status",
							});
						})
						.catch((error) =>
							logWatchlistError("sync remote show episode status", error),
						);
				} else {
					runJournaledMutation(queryClient, {
						begin: () =>
							watchlistOptimistic.beginMarkShowOp(queryClient, baseArgs),
						run: () => unwrap(markShowEpisodesAndStatus({ data: baseArgs })),
						syncKeys: [
							queryKeys.watchlist.list(),
							queryKeys.watchlist.episodes(Number(id)),
						],
						errorMessage: "sync show episode status",
					});
				}
				return;
			}

			const args: ProgressStatusArgs = {
				tmdbId: Number(id),
				mediaType,
				progressStatus,
				title: metadata?.title,
				image: metadata?.image,
				rating: metadata?.rating,
				release_date: metadata?.release_date,
				overview: metadata?.overview,
			};
			runJournaledMutation(queryClient, {
				begin: () =>
					watchlistOptimistic.beginProgressStatusOp(queryClient, args),
				run: () => unwrap(setProgressStatusFn({ data: args })),
				syncKeys: [queryKeys.watchlist.list()],
				errorMessage: "set progress status",
			});
		},

		setReaction(id, mediaType, reaction, metadata) {
			const payload: SetReactionArgs = {
				tmdbId: Number(id),
				mediaType,
				title: metadata?.title,
				image: metadata?.image,
				rating: metadata?.rating,
				release_date: metadata?.release_date,
				overview: metadata?.overview,
			};
			if (reaction) {
				payload.reaction = reaction;
			} else {
				payload.clearReaction = true;
			}

			runJournaledMutation(queryClient, {
				begin: () => watchlistOptimistic.beginReactionOp(queryClient, payload),
				run: () => unwrap(setReactionFn({ data: payload })),
				syncKeys: [queryKeys.watchlist.list()],
				errorMessage: "set reaction",
			});
		},
	};

	const lists: ListsRepository = {
		async deleteList(listId) {
			await runMutationAsync(queryClient, {
				begin: () => beginDeleteListOp(queryClient, listId, userId),
				run: () => unwrap(deleteCustomList({ data: { listId } })),
				syncKeys: [
					queryKeys.lists.all(userId),
					queryKeys.lists.itemsPrefix(),
					queryKeys.lists.itemListsPrefix(),
				],
				errorMessage: "delete custom list",
			});
		},

		async createList(args) {
			const optimisticId = `optimistic_${Date.now()}`;
			const handle = beginCreateListOp(queryClient, args, optimisticId, userId);
			try {
				const realId = await unwrap(createCustomList({ data: args }));
				swapListId(queryClient, optimisticId, realId, userId);
				handle?.resolve();
				scheduleSync(queryClient, [queryKeys.lists.all(userId)]);
				return realId;
			} catch (error) {
				console.error("Failed to create custom list", error);
				handle?.remove();
				scheduleSync(queryClient, [queryKeys.lists.all(userId)]);
				throw error;
			}
		},

		async createListAndAddItem(args) {
			const optimisticId = `optimistic_${Date.now()}`;
			const handle = beginCreateListAndAddOp(
				queryClient,
				args,
				optimisticId,
				userId,
			);
			try {
				const realId = await unwrap(createCustomListAndAddItem({ data: args }));
				swapListId(
					queryClient,
					optimisticId,
					realId,
					userId,
					queryKeys.lists.itemLists(args.tmdbId, args.mediaType, userId),
				);
				handle?.resolve();
				scheduleSync(queryClient, [
					queryKeys.lists.all(userId),
					queryKeys.lists.itemsPrefix(),
					queryKeys.lists.itemListsPrefix(),
				]);
			} catch (error) {
				console.error("Failed to create list and add item", error);
				handle?.remove();
				scheduleSync(queryClient, [
					queryKeys.lists.all(userId),
					queryKeys.lists.itemsPrefix(),
					queryKeys.lists.itemListsPrefix(),
				]);
				throw error;
			}
		},

		async updateList(args) {
			await runMutationAsync(queryClient, {
				begin: () => beginUpdateListOp(queryClient, args, userId),
				run: () => unwrap(updateCustomList({ data: args })),
				syncKeys: [queryKeys.lists.all(userId)],
				errorMessage: "update custom list",
			});
		},

		async toggleListItem(args) {
			const { handle, adding } = beginToggleListItemOp(
				queryClient,
				args,
				userId,
			);
			try {
				const result = await unwrap(toggleListItem({ data: args }));
				if (result !== adding) {
					applyToggleInverse(queryClient, args, adding, userId);
				}
				handle?.resolve();
				scheduleSync(queryClient, [
					queryKeys.lists.all(userId),
					queryKeys.lists.itemsPrefix(),
					queryKeys.lists.itemListsPrefix(),
				]);
			} catch (error) {
				console.error("Failed to toggle list item", error);
				handle?.remove();
				scheduleSync(queryClient, [
					queryKeys.lists.all(userId),
					queryKeys.lists.itemsPrefix(),
					queryKeys.lists.itemListsPrefix(),
				]);
				throw error;
			}
		},
	};

	return { ...watchlist, ...lists };
}

/**
 * Awaitable variant of `runJournaledMutation` for callers that need the write
 * to settle (e.g. dialogs that disable their submit button until it resolves).
 */
async function runMutationAsync(
	queryClient: QueryClient,
	{
		begin,
		run,
		syncKeys,
		errorMessage,
	}: {
		begin: () => OpHandle | undefined;
		run: () => Promise<unknown>;
		syncKeys: readonly (readonly unknown[])[];
		errorMessage: string;
	},
) {
	const handle = begin();
	try {
		await run();
		handle?.resolve();
	} catch (error) {
		logWatchlistError(errorMessage, error);
		handle?.remove();
		throw error;
	} finally {
		scheduleSync(queryClient, syncKeys);
	}
}
