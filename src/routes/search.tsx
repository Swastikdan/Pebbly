import { createFileRoute } from "@tanstack/react-router";
import { number, object, optional, string } from "valibot";

import { getMedia, getSearchResult } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

const searchPageSearchSchema = object({
  page: optional(number()),
  query: optional(string()),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchPageSearchSchema,
  loaderDeps: ({ search }) => ({ query: search.query, page: search.page }),
  loader: async ({ context, deps }) => {
    const trimmedQuery = (deps.query ?? "").trim();
    const hasValidQuery = trimmedQuery.length >= 2;
    const page = deps.page ?? 1;

    if (hasValidQuery) {
      await context.queryClient.ensureQueryData({
        queryKey: queryKeys.tmdb.search(trimmedQuery, page),
        queryFn: () => getSearchResult({ query: trimmedQuery, page }),
      });
    } else {
      await context.queryClient.ensureQueryData({
        queryKey: queryKeys.tmdb.trendingDay(),
        queryFn: () => getMedia({ type: "trending_day", page: 1 }),
      });
    }
  },
  head: ({ match }) => {
    const query = (match.search as { query?: string }).query?.trim();
    const hasValidQuery = Boolean(query && query.length >= 2);
    const title = hasValidQuery
      ? `Search: ${query} | Pebbly`
      : "Search Results | Pebbly";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: hasValidQuery
            ? `Search results for "${query}"`
            : "Search for movies and TV shows",
        },
      ],
    };
  },
});
