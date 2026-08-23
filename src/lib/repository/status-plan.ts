import type { QueryClient } from "@tanstack/react-query";
import { watchlistOptimistic } from "@/hooks/watchlist/watchlist-optimistic";
import type { MediaType } from "@/hooks/watchlist-store";
import { getTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import type { ProgressStatus } from "@/types";
import {
	type ProgressStatusAction,
	resolveProgressStatusAction,
} from "./types";

export interface SeasonSelection {
	season: number;
	episodes: number[];
}

export interface StatusPlan {
	action: ProgressStatusAction;
	/** Resolves with per-season episode selections when episode rows must
	 *  follow the new status; null when no episode sync is needed. */
	seasonsPromise: Promise<SeasonSelection[]> | null;
}

/**
 * One decision pipeline for progress-status writes shared by both repository
 * adapters: resolves the TV-vs-movie action and, when episode state must
 * follow the status, kicks off the single TMDB season fetch both adapters
 * previously duplicated. Adapters execute the plan; neither re-implements
 * the semantics.
 */
export function resolveStatusPlan(
	queryClient: QueryClient,
	id: string,
	mediaType: MediaType,
	progressStatus: ProgressStatus,
	currentStatus?: ProgressStatus | null,
): StatusPlan {
	const action = resolveProgressStatusAction(
		mediaType,
		progressStatus,
		currentStatus,
	);

	if (action.type !== "tv") return { action, seasonsPromise: null };

	const clearAllEpisodes =
		action.isLeavingCompletion && !action.shouldMarkWatched;
	const needsSeasons = action.needsEpisodeUpdate && !clearAllEpisodes;

	const seasonsPromise = needsSeasons
		? queryClient
				.ensureQueryData({
					queryKey: queryKeys.tmdb.tvDetails(Number(id)),
					queryFn: () => getTvDetails({ id: Number(id) }),
				})
				.then((details) =>
					watchlistOptimistic.buildSeasonEpisodeSelections(details),
				)
		: null;

	return { action, seasonsPromise };
}
