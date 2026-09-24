import type { EpisodeProgressRow, WatchItemRow } from "@/lib/server-types";
import type { ProgressStatus } from "@/server/schema/common";
import type { QueryClient } from "@tanstack/react-query";
import { reconcileListFetch } from "@/lib/data/pending-ops";
import { queryKeys } from "@/lib/query/keys";
import {
  getAllEpisodeProgress,
  getAllWatchedEpisodes,
  getWatchlist,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";

export async function fetchWatchlistList(
  queryClient: QueryClient,
  userId?: string,
): Promise<WatchItemRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.watchlist.list(undefined, userId),
    await unwrap(getWatchlist({ data: {} })),
  );
}

export async function fetchWatchlistListFiltered(
  queryClient: QueryClient,
  args: {
    statusFilter?: ProgressStatus;
    limit?: number;
  },
  userId?: string,
): Promise<WatchItemRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.watchlist.list(args, userId),
    await unwrap(getWatchlist({ data: args })),
  );
}

export async function fetchWatchedEpisodes(
  queryClient: QueryClient,
  tmdbId: number,
  userId?: string,
): Promise<EpisodeProgressRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.watchlist.episodes(tmdbId, userId),
    await unwrap(getAllWatchedEpisodes({ data: { tmdbId } })),
  );
}

export async function fetchAllEpisodeProgress(
  queryClient: QueryClient,
  userId?: string,
): Promise<EpisodeProgressRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.watchlist.allEpisodes(userId),
    await unwrap(getAllEpisodeProgress()),
  );
}
