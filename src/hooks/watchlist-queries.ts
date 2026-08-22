import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { EpisodeProgressRow, WatchItemRow } from "@/lib/server-types";
import {
	getAllEpisodeProgress,
	getAllWatchedEpisodes,
	getWatchlist,
} from "@/server/fns/watchlist";
import { type ProgressStatus, unwrap } from "@/server/schema/common";
import { reconcileListFetch } from "./pending-ops";

/**
 * Query functions for watchlist caches. Each one routes its server response
 * through the pending-op reconciler so a refetch can never clobber optimistic
 * state that is still in flight. The `queryClient` param scopes the reconciler
 * journal to the calling client (per-request during SSR).
 */

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
