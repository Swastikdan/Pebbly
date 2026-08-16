import { queryKeys } from "@/lib/query/keys";
import type { EpisodeProgressRow, WatchItemRow } from "@/lib/server-types";
import {
	getAllEpisodeProgress,
	getAllWatchedEpisodes,
	getWatchlist,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import { reconcileListFetch } from "./pending-ops";

/**
 * Query functions for watchlist caches. Each one routes its server response
 * through the pending-op reconciler so a refetch can never clobber optimistic
 * state that is still in flight.
 */

export async function fetchWatchlistList(): Promise<WatchItemRow[]> {
	return reconcileListFetch(
		queryKeys.watchlist.list(),
		await unwrap(getWatchlist({ data: {} })),
	);
}

export async function fetchWatchlistListFiltered(args: {
	statusFilter?: string;
	limit?: number;
}): Promise<WatchItemRow[]> {
	return reconcileListFetch(
		queryKeys.watchlist.list(args),
		await unwrap(getWatchlist({ data: args })),
	);
}

export async function fetchWatchedEpisodes(
	tmdbId: number,
): Promise<EpisodeProgressRow[]> {
	return reconcileListFetch(
		queryKeys.watchlist.episodes(tmdbId),
		await unwrap(getAllWatchedEpisodes({ data: { tmdbId } })),
	);
}

export async function fetchAllEpisodeProgress(): Promise<EpisodeProgressRow[]> {
	return reconcileListFetch(
		queryKeys.watchlist.allEpisodes(),
		await unwrap(getAllEpisodeProgress()),
	);
}
