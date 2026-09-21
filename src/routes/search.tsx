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
  // Search parameters change while the user is actively typing. Keep the
  // current route mounted while the loader warms the next query so the input
  // never loses focus or gets replaced by the app-wide loader.
  pendingComponent: () => null,
  loader: async ({ context, deps }) => {
    const trimmedQuery = (deps.query ?? "").trim();
    const hasValidQuery = trimmedQuery.length >= 2;
    const page = deps.page ?? 1;

    if (hasValidQuery) {
      const searchResults = await context.queryClient.ensureQueryData({
        queryKey: queryKeys.tmdb.search(trimmedQuery, page),
        queryFn: () => getSearchResult({ query: trimmedQuery, page }),
      });
      return { page, query: trimmedQuery, searchResults };
    } else {
      const trendingResults = await context.queryClient.ensureQueryData({
        queryKey: queryKeys.tmdb.trendingDay(),
        queryFn: () => getMedia({ type: "trending_day", page: 1 }),
      });
      return { page, query: trimmedQuery, trendingResults };
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
