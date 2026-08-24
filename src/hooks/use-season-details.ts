import { useQuery } from "@tanstack/react-query";

import type { TvSeasonDetail } from "@/lib/tmdb-schemas";
import { createBatcher } from "@/lib/batcher";
import { getTvSeasonDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

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
