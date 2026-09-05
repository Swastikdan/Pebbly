import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";

export const watchlistSearchSchema = v.object({
  tab: v.optional(v.string()),
});

export type WatchlistSearch = v.InferOutput<typeof watchlistSearchSchema>;

export const Route = createFileRoute("/watchlist")({
  validateSearch: watchlistSearchSchema,
  head: () => ({
    meta: [
      { title: "Watchlist | Pebbly" },
      {
        name: "description",
        content: "Your saved movies and TV shows.",
      },
    ],
  }),
});
