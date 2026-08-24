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
): Promise<WatchItemRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.watchlist.list(),
    await unwrap(getWatchlist({ data: {} })),
  );
}

export async function fetchWatchlistListFiltered(
  queryClient: QueryClient,
  args: {
    statusFilter?: ProgressStatus;
    limit?: number;
  },
): Promise<WatchItemRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.watchlist.list(args),
    await unwrap(getWatchlist({ data: args })),
  );
}

export async function fetchWatchedEpisodes(
  queryClient: QueryClient,
  tmdbId: number,
): Promise<EpisodeProgressRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.watchlist.episodes(tmdbId),
    await unwrap(getAllWatchedEpisodes({ data: { tmdbId } })),
  );
}

export async function fetchAllEpisodeProgress(
  queryClient: QueryClient,
): Promise<EpisodeProgressRow[]> {
  return reconcileListFetch(
    queryClient,
    queryKeys.watchlist.allEpisodes(),
    await unwrap(getAllEpisodeProgress()),
  );
}
