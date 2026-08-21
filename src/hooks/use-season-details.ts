import { useQuery } from "@tanstack/react-query";
import { createBatcher } from "@/lib/batcher";
import { getTvSeasonDetails } from "@/lib/queries";
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
 * Fetch a TV season's details through the shared batcher. `season` may be
 * undefined while the next-episode context is still resolving; the query stays
 * disabled until it arrives.
 */
export function useSeasonDetails(tvId: number, season: number | undefined) {
	return useQuery({
		queryKey: ["tv-season", tvId, season],
		queryFn: () => seasonDetailBatcher.schedule({ tvId, season: season ?? 1 }),
		enabled: !!season,
	});
}
