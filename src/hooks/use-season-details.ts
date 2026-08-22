import { useQuery } from "@tanstack/react-query";
import { createBatcher } from "@/lib/batcher";
import { getTvSeasonDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import type { TvSeasonDetail } from "@/lib/tmdb-schemas";

/**
 * Coalesce per-card season-detail fetches. A continue-watching strip renders N
 * cards, each needing the season detail for its next episode. Without
 * batching that is N parallel TMDB requests from the same render pass.
 *
 * The batcher flushes all cards' season requests in one window and dedupes the
 * same (show, season) across card instances / re-renders, so a season is never
 * fetched twice for the same screen.
 */
const seasonDetailBatcher = createBatcher<
	{ tvId: number; season: number },
	TvSeasonDetail
>(
	async (items) => {
		return await Promise.all(
			items.map(({ tvId, season }) =>
				getTvSeasonDetails({ tvId, seasonNumber: season }),
			),
		);
	},
	{
		delayMs: 50,
		maxBatchSize: 30,
		getKey: ({ tvId, season }) => `${tvId}:${season}`,
	},
);

/**
 * Fetch a TV season's details through the shared batcher. Every consumer
 * (per-card hook, season page, inline episode browser) uses this fetcher with
 * the same `tmdb.seasonDetails` key so one cache entry is filled per
 * (show, season), coalesced across whatever requested it first.
 */
export function fetchSeasonDetails(tvId: number, season: number) {
	return seasonDetailBatcher.schedule({ tvId, season });
}

export function useSeasonDetails(tvId: number, season: number | undefined) {
	return useQuery({
		queryKey: queryKeys.tmdb.seasonDetails(tvId, season ?? 1),
		queryFn: () => fetchSeasonDetails(tvId, season ?? 1),
		enabled: !!season,
	});
}
