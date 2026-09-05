import * as v from "valibot";

import type { ListsRepository, Repository, WatchlistRepository } from "./types";
import type {
  MarkShowEpisodesAndStatusArgs,
  ProgressStatusArgs,
  SetReactionArgs,
} from "@/lib/data/optimistic/watchlist-optimistic";
import type { EpisodeProgressRow, WatchItemRow } from "@/lib/server-types";
import type { QueryClient } from "@tanstack/react-query";
import {
  pendingMutationsFor,
  removeMutation,
} from "@/lib/data/mutation-outbox";
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
import { beginOp, scheduleSync } from "@/lib/data/pending-ops";
import { toast } from "@/lib/notifications";
import { listsSyncKeys, queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import { createMembershipWriter } from "@/lib/repository/membership-writer";
import { extractMetadataFields, logError } from "@/lib/utils";
import {
  episodeRowIdOf,
  toggleEpisodeRows,
  toggleSeasonRows,
} from "@/lib/watch-progress";
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
import {
  markEpisodeWatchedArgsSchema,
  markSeasonEpisodesWatchedArgsSchema,
  markShowEpisodesAndStatusArgsSchema,
  mediaIdentityArgsSchema,
  setProgressStatusArgsSchema,
  setReactionArgsSchema,
  setWatchlistMembershipArgsSchema,
  updateProgressArgsSchema,
} from "@/server/schema/watchlist";
import { runMutationAsync } from "./mutation-runner";
import { resolveStatusPlan } from "./types";

/**
 * Fire-and-forget mutation runner used by the side-effect write paths
 * (episodes, reactions, progress). The UI has already applied the optimistic
 * state, so a server failure must not vanish silently: the op is rolled back
 * (`runMutationAsync` removes the journal handle) and a toast tells the user
 * the change could not be saved. (architecture-hardening-plan item 7.)
 */
function runJournaledMutation(
  queryClient: QueryClient,
  options: Parameters<typeof runMutationAsync>[1] & { notifyError?: string },
) {
  runMutationAsync(queryClient, options).catch(() => {
    if (options.notifyError) {
      toast({
        title: "Couldn't sync",
        description: options.notifyError,
        type: "error",
      });
    }
  });
}

async function replayPendingMutations(userId: string): Promise<void> {
  for (const record of pendingMutationsFor(userId)) {
    try {
      let payload: unknown;
      let run: ((data: never) => Promise<unknown>) | undefined;

      switch (record.kind) {
        case "set-membership": {
          const parsed = v.safeParse(
            setWatchlistMembershipArgsSchema,
            record.payload,
          );
          if (!parsed.success) break;
          payload = parsed.output;
          run = (data) => unwrap(setWatchlistMembership({ data }));
          break;
        }
        case "set-progress-status": {
          const parsed = v.safeParse(
            setProgressStatusArgsSchema,
            record.payload,
          );
          if (!parsed.success) break;
          payload = parsed.output;
          run = (data) => unwrap(setProgressStatusFn({ data }));
          break;
        }
        case "set-reaction": {
          const parsed = v.safeParse(setReactionArgsSchema, record.payload);
          if (!parsed.success) break;
          payload = parsed.output;
          run = (data) => unwrap(setReactionFn({ data }));
          break;
        }
        case "mark-episode": {
          const parsed = v.safeParse(
            markEpisodeWatchedArgsSchema,
            record.payload,
          );
          if (!parsed.success) break;
          payload = parsed.output;
          run = (data) => unwrap(markEpisodeWatched({ data }));
          break;
        }
        case "mark-season": {
          const parsed = v.safeParse(
            markSeasonEpisodesWatchedArgsSchema,
            record.payload,
          );
          if (!parsed.success) break;
          payload = parsed.output;
          run = (data) => unwrap(markSeasonEpisodesWatched({ data }));
          break;
        }
        case "mark-show-episodes": {
          const parsed = v.safeParse(
            markShowEpisodesAndStatusArgsSchema,
            record.payload,
          );
          if (!parsed.success) break;
          payload = parsed.output;
          run = (data) => unwrap(markShowEpisodesAndStatus({ data }));
          break;
        }
        case "update-progress": {
          const parsed = v.safeParse(updateProgressArgsSchema, record.payload);
          if (!parsed.success) break;
          payload = parsed.output;
          run = (data) => unwrap(updateProgressFn({ data }));
          break;
        }
        case "remove-continue-watching": {
          const parsed = v.safeParse(mediaIdentityArgsSchema, record.payload);
          if (!parsed.success) break;
          payload = parsed.output;
          run = (data) => unwrap(removeFromContinueWatchingFn({ data }));
          break;
        }
      }

      if (!run || payload === undefined) {
        // Invalid or obsolete records must not block newer mutations forever.
        removeMutation(record.id);
        continue;
      }
      await run(payload as never);
      removeMutation(record.id);
    } catch (error) {
      logError("replay pending mutation", error);
      // Preserve the record for the next boot; stop here to retain ordering.
      break;
    }
  }
}

export function replayRemoteMutations(userId: string): Promise<void> {
  return replayPendingMutations(userId);
}

export function createRemoteRepository(
  queryClient: QueryClient,
  userId: string | undefined,
): Repository {
  const memberships = createMembershipWriter(queryClient, userId);

  const watchlist: WatchlistRepository = {
    async toggleMembership(item, inWatchlist) {
      await memberships.toggleMembership(item, inWatchlist);
    },

    async setProgressStatus({
      id,
      mediaType,
      progressStatus,
      metadata,
      currentStatus,
      progress,
    }) {
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
          ...extractMetadataFields(metadata),
        };
        const statusArgs: ProgressStatusArgs = {
          tmdbId: Number(id),
          mediaType,
          progressStatus,
          progress: action.progress,
          ...extractMetadataFields(metadata),
        };
        const syncKeys = [
          queryKeys.watchlist.list(),
          queryKeys.watchlist.episodes(Number(id)),
        ];
        const send = (
          args: MarkShowEpisodesAndStatusArgs,
          kind = "mark-show",
        ) =>
          runJournaledMutation(queryClient, {
            begin: () => watchlistOptimistic.beginMarkShowOp(queryClient, args),
            run: () => unwrap(markShowEpisodesAndStatus({ data: args })),
            syncKeys,
            errorMessage: "sync show episode status",
            notifyError: "Couldn't sync your episode status.",
            outbox: userId ? { userId, kind, payload: args } : undefined,
          });

        if (action.isLeavingCompletion && !action.shouldMarkWatched) {
          send({ ...baseArgs, clearAllEpisodes: true });
        } else if (seasonsPromise) {
          // Persist the status immediately. Episode expansion depends on a
          // remote details request and must never make the status click look
          // like a no-op. Episode rows are sent only after this write succeeds.
          runMutationAsync(queryClient, {
            begin: () =>
              watchlistOptimistic.beginProgressStatusOp(
                queryClient,
                statusArgs,
              ),
            run: () => unwrap(setProgressStatusFn({ data: statusArgs })),
            syncKeys: [queryKeys.watchlist.list()],
            errorMessage: "set show progress status",
            outbox: userId
              ? {
                  userId,
                  kind: "set-progress-status",
                  payload: statusArgs,
                }
              : undefined,
          })
            .then(() => seasonsPromise)
            .then((seasons) =>
              send(
                {
                  ...baseArgs,
                  seasons,
                  isWatched: action.shouldMarkWatched,
                  progressStatus: undefined,
                },
                "mark-show-episodes",
              ),
            )
            .catch((error) => {
              logError("sync show status or load season details", error);
              toast({
                title: "Episode progress not synced",
                description:
                  "Couldn't load season details, so episode markings weren't updated. Your status was saved if the status write succeeded.",
                type: "warning",
              });
            });
        } else {
          send({ ...baseArgs });
        }
        return;
      }

      const args: ProgressStatusArgs = {
        tmdbId: Number(id),
        mediaType,
        progressStatus,
        progress,
        ...extractMetadataFields(metadata),
      };
      runJournaledMutation(queryClient, {
        begin: () =>
          watchlistOptimistic.beginProgressStatusOp(queryClient, args),
        run: () => unwrap(setProgressStatusFn({ data: args })),
        syncKeys: [queryKeys.watchlist.list()],
        errorMessage: "set progress status",
        outbox: userId
          ? { userId, kind: "set-progress-status", payload: args }
          : undefined,
      });
    },

    setReaction({ id, mediaType, reaction, metadata }) {
      const payload: SetReactionArgs = {
        tmdbId: Number(id),
        mediaType,
        ...extractMetadataFields(metadata),
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
        notifyError: "Couldn't save your reaction change.",
        outbox: userId ? { userId, kind: "set-reaction", payload } : undefined,
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
        notifyError: "Couldn't save episode progress.",
        outbox: userId
          ? { userId, kind: "mark-episode", payload: args }
          : undefined,
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
        notifyError: "Couldn't save episode progress.",
        outbox: userId
          ? { userId, kind: "mark-season", payload: args }
          : undefined,
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
        notifyError: "Couldn't save your progress.",
        outbox: userId
          ? { userId, kind: "update-progress", payload: args }
          : undefined,
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
        notifyError: "Couldn't update continue watching.",
        outbox: userId
          ? {
              userId,
              kind: "remove-continue-watching",
              payload: { tmdbId, mediaType },
            }
          : undefined,
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
