import type { ReactionStatus } from "@/domain/watchlist";
import type { EpisodeProgressRow, WatchItemRow } from "@/lib/server-types";
import type { ProgressStatus } from "@/server/schema/common";
import type { QueryClient } from "@tanstack/react-query";
import { reconcileListFetch } from "@/lib/data/pending-ops";
import { queryKeys } from "@/lib/query/keys";
import {
  getAllEpisodeProgress,
  getAllWatchedEpisodes,
  getWatchlist,
  getWatchlistPage,
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

export async function fetchWatchlistPage(
  _queryClient: QueryClient,
  args: {
    cursor?: string;
    limit?: number;
    statusFilter?: ProgressStatus;
    mediaType?: "movie" | "tv";
    reactionFilter?: "all" | "none" | ReactionStatus;
    search?: string;
    sort?: "recent" | "rating" | "title" | "year";
  },
  _userId?: string,
) {
  return unwrap(getWatchlistPage({ data: args }));
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
