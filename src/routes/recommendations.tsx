import { createFileRoute, notFound } from "@tanstack/react-router";
import * as v from "valibot";

import { queryKeys } from "@/lib/query/keys";
import {
  getRecommendationHistory,
  getUserRecommendationAccess,
} from "@/server/fns/recommendations";
import { getTrackedTmdbIds } from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";

export const recommendationsSearchSchema = v.object({
  activeId: v.optional(v.string()),
});

export type RecommendationsSearch = v.InferOutput<
  typeof recommendationsSearchSchema
>;

export const Route = createFileRoute("/recommendations")({
  validateSearch: recommendationsSearchSchema,
  loader: async ({ context }) => {
    const access = await unwrap(getUserRecommendationAccess()).catch(() => ({
      hasAccess: false as const,
      reason: "not_authenticated" as const,
    }));

    if (!access.hasAccess) {
      throw notFound();
    }

    const userId = "userId" in access ? access.userId : undefined;

    await Promise.allSettled([
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.recommendations.history(userId),
        queryFn: () => unwrap(getRecommendationHistory()),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.watchlist.trackedTmdbIds(userId),
        queryFn: () => unwrap(getTrackedTmdbIds()),
      }),
    ]);

    return {
      userId,
    };
  },
  head: () => ({
    meta: [
      { title: "AI Recommendations | Pebbly" },
      {
        name: "description",
        content:
          "AI-powered movie and TV show recommendations based on your watchlist.",
      },
    ],
  }),
});
