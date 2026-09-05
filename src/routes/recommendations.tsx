import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";

export const recommendationsSearchSchema = v.object({
  activeId: v.optional(v.string()),
});

export type RecommendationsSearch = v.InferOutput<
  typeof recommendationsSearchSchema
>;

export const Route = createFileRoute("/recommendations")({
  validateSearch: recommendationsSearchSchema,
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
