import type { ListsRepository, Repository, WatchlistRepository } from "./types";
import type {
  MarkShowEpisodesAndStatusArgs,
  ProgressStatusArgs,
  SetReactionArgs,
  WatchlistMembershipArgs,
} from "@/lib/data/optimistic/watchlist-optimistic";
import type { OpHandle } from "@/lib/data/pending-ops";
import type { EpisodeProgressRow, WatchItemRow } from "@/lib/server-types";
import type { QueryClient } from "@tanstack/react-query";
import {
  episodeRowIdOf,
  toggleEpisodeRows,
  toggleSeasonRows,
} from "@/hooks/watch-progress/progress-helpers";
import { createBatcher } from "@/lib/batcher";
import {
  applyToggleInverse,
  beginCreateListAndAddOp,
  beginCreateListOp,
  beginDeleteListOp,
  beginReorderListItemsOp,
  beginToggleListItemOp,
  beginUpdateListOp,
  swapListId,
} from "@/lib/data/optimistic/list-optimistic";
import {
  applyProgressResetRows,
  applyProgressUpdateRows,
  watchlistOptimistic,
} from "@/lib/data/optimistic/watchlist-optimistic";
import {
  applyServerState,
  beginOp,
  scheduleSync,
} from "@/lib/data/pending-ops";
import { listsSyncKeys, queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import {
  cloneCustomList,
  createCustomList,
  createCustomListAndAddItem,
  deleteCustomList,
  reorderListItems,
  toggleListItem,
  updateCustomList,
} from "@/server/fns/lists";
import {
  batchSetWatchlistMembership,
  markEpisodeWatched,
  markSeasonEpisodesWatched,
  markShowEpisodesAndStatus,
  removeFromContinueWatching as removeFromContinueWatchingFn,
  setProgressStatus as setProgressStatusFn,
  setReaction as setReactionFn,
  setWatchlistMembership,
  updateProgress as updateProgressFn,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import { resolveStatusPlan } from "./status-plan";

function logWatchlistError(action: string, error: unknown) {
  console.error(`Failed to ${action}`, error);
}

/**
 * Run a server write through the optimistic journal: begin the op, resolve on
 * success, roll back on failure, and always schedule a background sync. This
 * replicates the `useMutation` lifecycle (onMutate/onSuccess/onError/onSettled)
 * imperatively so the repository does not depend on hooks. Own-write revision
 * counting is handled by the op's domain tag (see `beginOp`).
 */
async function runMutationAsync<T = unknown>(
  queryClient: QueryClient,
  {
    begin,
    run,
    syncKeys,
    errorMessage,
    onSuccess,
  }: {
    begin: () => OpHandle | undefined;
    run: () => Promise<T>;
    syncKeys: readonly (readonly unknown[])[];
    errorMessage: string;
    onSuccess?: (result: T) => void;
  },
): Promise<T> {
  const handle = begin();
  try {
    const result = await run();
    onSuccess?.(result);
    handle?.resolve();
    return result;
  } catch (error) {
    logWatchlistError(errorMessage, error);
    handle?.remove();
    throw error;
  } finally {
    scheduleSync(queryClient, syncKeys);
  }
}

/**
 * Fire-and-forget variant of `runMutationAsync` for callers that don't await
 * the write; failures are logged and rolled back inside the async runner.
 */
function runJournaledMutation(
  queryClient: QueryClient,
  options: Parameters<typeof runMutationAsync>[1],
) {
  runMutationAsync(queryClient, options).catch(() => {});
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

      // Merge the authoritative rows into the cache (no full refetch, the
      // server response already reflects this batch). Touched items missing
      // from the response were deleted.
      // Each flush is one server write (single or batched), which bumps the
      // watchlist revision once.
      recordOwnMutation("watchlist");
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

    async setProgressStatus(
      id,
      mediaType,
      progressStatus,
      metadata,
      currentStatus,
    ) {
      const { action, seasonsPromise } = resolveStatusPlan(
        queryClient,
        id,
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
        const syncKeys = [
          queryKeys.watchlist.list(),
          queryKeys.watchlist.episodes(Number(id)),
        ];
        const send = (extra: Partial<MarkShowEpisodesAndStatusArgs>) =>
          runJournaledMutation(queryClient, {
            begin: () =>
              watchlistOptimistic.beginMarkShowOp(queryClient, {
                ...baseArgs,
                ...extra,
              }),
            run: () =>
              unwrap(
                markShowEpisodesAndStatus({
                  data: { ...baseArgs, ...extra },
                }),
              ),
            syncKeys,
            errorMessage: "sync show episode status",
          });

        if (action.isLeavingCompletion && !action.shouldMarkWatched) {
          send({ clearAllEpisodes: true });
        } else if (seasonsPromise) {
          seasonsPromise
            .then((seasons) =>
              send({
                seasons,
                isWatched: action.shouldMarkWatched,
              }),
            )
            .catch((error) =>
              logWatchlistError("sync remote show episode status", error),
            );
        } else {
          send({});
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

    async markEpisode(args) {
      const episodeKey = queryKeys.watchlist.episodes(args.tmdbId);
      runJournaledMutation(queryClient, {
        begin: () =>
          beginOp(
            queryClient,
            [
              {
                key: episodeKey,
                touchedIds: [`${args.tmdbId}:${args.season}:${args.episode}`],
                idOf: episodeRowIdOf,
                apply: (rows: EpisodeProgressRow[]) =>
                  toggleEpisodeRows(rows, args),
              },
            ],
            { domain: "watchlist" },
          ),
        run: () => unwrap(markEpisodeWatched({ data: args })),
        syncKeys: [episodeKey],
        errorMessage: "toggle episode watched",
      });
    },

    async markSeason(args) {
      const episodeKey = queryKeys.watchlist.episodes(args.tmdbId);
      runJournaledMutation(queryClient, {
        begin: () =>
          beginOp(
            queryClient,
            [
              {
                key: episodeKey,
                touchedIds: args.episodes.map(
                  (episode) => `${args.tmdbId}:${args.season}:${episode}`,
                ),
                idOf: episodeRowIdOf,
                apply: (rows: EpisodeProgressRow[]) =>
                  toggleSeasonRows(rows, args),
              },
            ],
            { domain: "watchlist" },
          ),
        run: () => unwrap(markSeasonEpisodesWatched({ data: args })),
        syncKeys: [episodeKey],
        errorMessage: "mark season episodes watched",
      });
    },

    async updateProgress(args) {
      const listKey = queryKeys.watchlist.list();
      runJournaledMutation(queryClient, {
        begin: () =>
          beginOp(
            queryClient,
            [
              {
                key: listKey,
                touchedIds: [`${args.mediaType}:${args.tmdbId}`],
                apply: (rows: WatchItemRow[]) =>
                  applyProgressUpdateRows(rows, args),
              },
            ],
            { domain: "watchlist" },
          ),
        run: () => {
          if (args.progressStatus !== undefined) {
            const statusArgs: ProgressStatusArgs = {
              ...args,
              progressStatus: args.progressStatus,
            };
            return unwrap(setProgressStatusFn({ data: statusArgs }));
          }
          return unwrap(updateProgressFn({ data: args }));
        },
        syncKeys: [listKey],
        errorMessage: "update progress",
      });
    },

    async removeFromContinueWatching(tmdbId, mediaType) {
      const listKey = queryKeys.watchlist.list();
      runJournaledMutation(queryClient, {
        begin: () =>
          beginOp(
            queryClient,
            [
              {
                key: listKey,
                touchedIds: [`${mediaType}:${tmdbId}`],
                apply: (rows: WatchItemRow[]) =>
                  applyProgressResetRows(rows, { tmdbId, mediaType }),
              },
            ],
            { domain: "watchlist" },
          ),
        run: () =>
          unwrap(
            removeFromContinueWatchingFn({
              data: { tmdbId, mediaType },
            }),
          ),
        syncKeys: [listKey],
        errorMessage: "remove from continue watching",
      });
    },
  };

  const lists: ListsRepository = {
    async deleteList(listId) {
      await runMutationAsync(queryClient, {
        begin: () => beginDeleteListOp(queryClient, listId, userId),
        run: () => unwrap(deleteCustomList({ data: { listId } })),
        syncKeys: listsSyncKeys(userId),
        errorMessage: "delete custom list",
      });
    },

    async createList(args) {
      const optimisticId = `optimistic_${Date.now()}`;
      return runMutationAsync<string>(queryClient, {
        begin: () => beginCreateListOp(queryClient, args, optimisticId, userId),
        run: () => unwrap(createCustomList({ data: args })),
        onSuccess: (realId) =>
          swapListId(queryClient, optimisticId, realId, userId),
        syncKeys: [queryKeys.lists.all(userId)],
        errorMessage: "create custom list",
      });
    },

    async createListAndAddItem(args) {
      const optimisticId = `optimistic_${Date.now()}`;
      await runMutationAsync<string>(queryClient, {
        begin: () =>
          beginCreateListAndAddOp(queryClient, args, optimisticId, userId),
        run: () => unwrap(createCustomListAndAddItem({ data: args })),
        onSuccess: (realId) =>
          swapListId(
            queryClient,
            optimisticId,
            realId,
            userId,
            queryKeys.lists.itemLists(args.tmdbId, args.mediaType, userId),
          ),
        syncKeys: listsSyncKeys(userId),
        errorMessage: "create list and add item",
      });
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
      let adding = false;
      return runMutationAsync<boolean>(queryClient, {
        begin: () => {
          const op = beginToggleListItemOp(queryClient, args, userId);
          adding = op.adding;
          return op.handle;
        },
        run: () => unwrap(toggleListItem({ data: args })),
        onSuccess: (result) => {
          if (result !== adding) {
            applyToggleInverse(queryClient, args, adding, userId);
          }
        },
        syncKeys: listsSyncKeys(userId),
        errorMessage: "toggle list item",
      });
    },

    async reorderListItem(args) {
      await runMutationAsync(queryClient, {
        begin: () => beginReorderListItemsOp(queryClient, args, userId),
        run: () => unwrap(reorderListItems({ data: args })),
        syncKeys: [queryKeys.lists.items(args.listId, userId)],
        errorMessage: "reorder list items",
      });
    },

    async cloneList(sourceListId) {
      const newId = await unwrap(cloneCustomList({ data: { sourceListId } }));
      recordOwnMutation("lists");
      scheduleSync(queryClient, [queryKeys.lists.all(userId)]);
      return newId;
    },
  };

  return { ...watchlist, ...lists };
}
