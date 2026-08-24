import type { ProgressStatusAction } from "./types";
import type { MediaType } from "@/stores/watchlist-store";
import type { ProgressStatus } from "@/types";
import type { QueryClient } from "@tanstack/react-query";
import { watchlistOptimistic } from "@/lib/data/optimistic/watchlist-optimistic";
import { getTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { resolveProgressStatusAction } from "./types";

export interface SeasonSelection {
  season: number;
  episodes: number[];
}

export interface StatusPlan {
  action: ProgressStatusAction;
  seasonsPromise: Promise<SeasonSelection[]> | null;
}

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
