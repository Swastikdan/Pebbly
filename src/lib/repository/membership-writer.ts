import type { WatchlistMembershipArgs } from "@/lib/data/optimistic/watchlist-optimistic";
import type { OpHandle } from "@/lib/data/pending-ops";
import type { WatchItemRow } from "@/lib/server-types";
import type { QueryClient } from "@tanstack/react-query";
import { createBatcher } from "@/lib/batcher";
import { enqueueMutation, removeMutation } from "@/lib/data/mutation-outbox";
import { watchlistOptimistic } from "@/lib/data/optimistic/watchlist-optimistic";
import { applyServerState, scheduleSync } from "@/lib/data/pending-ops";
import { toast } from "@/lib/notifications";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import { logError } from "@/lib/utils";
import {
  batchSetWatchlistMembership,
  setWatchlistMembership,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";

export type BatchedWatchlistMembershipTask = {
  args: WatchlistMembershipArgs;
  handle?: OpHandle;
  queryClient: QueryClient;
  outboxId?: string;
};

/**
 * Owns the watchlist-membership write path: batching, optimistic-handle
 * resolution, server sync and crash-recovery outboxing. Extracted from
 * `remote-repository.ts` so the 600-line adapter file reads as a flat table
 * of repository methods; the membership machinery is the only piece with
 * real internal state, so it becomes an object with one method.
 *
 * The external `Repository` interface is unchanged — `createRemoteRepository`
 * delegates `toggleMembership` to this writer.
 */
export function createMembershipWriter(
  queryClient: QueryClient,
  userId: string | undefined,
) {
  const batcher = createBatcher<BatchedWatchlistMembershipTask, WatchItemRow>(
    async (tasks) => {
      const items = tasks.map((t) => t.args);

      try {
        let rows: WatchItemRow[];
        if (items.length === 1) {
          const row = await unwrap(setWatchlistMembership({ data: items[0] }));
          rows = row ? [row] : [];
        } else {
          rows = await unwrap(batchSetWatchlistMembership({ data: { items } }));
        }

        // Each flush is one server write (single or batched), which bumps the
        // watchlist revision once.
        recordOwnMutation("watchlist");
        applyServerState(
          queryClient,
          queryKeys.watchlist.list(),
          rows,
          items.map((i) => `${i.mediaType}:${i.tmdbId}`),
        );
        for (const task of tasks) {
          task.handle?.resolve();
          if (task.outboxId) removeMutation(task.outboxId);
        }
        // The tracked-ids query derives from the watchlist, so keep it fresh.
        scheduleSync(queryClient, [queryKeys.watchlist.trackedTmdbIds()]);
        return rows;
      } catch (error) {
        logError("batch set watchlist membership", error);
        for (const task of tasks) {
          task.handle?.remove();
        }
        toast({
          title: "Couldn't update watchlist",
          description: "The change was reverted. Please try again.",
          type: "error",
        });
        // The server may have applied part of the batch before failing; a
        // refresh reconciles the cache with the authoritative state.
        scheduleSync(queryClient, [queryKeys.watchlist.list()]);
        throw error;
      }
    },
    {
      delayMs: 300,
      maxWaitMs: 1200,
      maxBatchSize: 100,
      getKey: (task) => `${task.args.mediaType}:${task.args.tmdbId}`,
      flushOnPageHide: true,
    },
  );

  return {
    async toggleMembership(
      item: {
        id: string;
        media_type: "movie" | "tv";
        title: string;
        image: string;
        rating: number;
        release_date: string;
        overview?: string;
      },
      inWatchlist: boolean,
    ): Promise<void> {
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
      const outboxId = userId
        ? enqueueMutation(
            userId,
            "set-membership",
            args,
            `${args.mediaType}:${args.tmdbId}`,
          )
        : undefined;
      await batcher.schedule({
        args,
        handle,
        queryClient,
        outboxId,
      });
    },

    dispose() {
      batcher.dispose();
    },
  };
}
