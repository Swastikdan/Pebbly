import { createFileRoute } from "@tanstack/react-router";
import { number, object, optional, string } from "valibot";

const searchPageSearchSchema = object({
  page: optional(number()),
  query: optional(string()),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchPageSearchSchema,
  head: ({ match }) => {
    const query = (match.search as { query?: string }).query?.trim();
    const title = query
      ? `Search: ${query} | Pebbly`
      : "Search Results | Pebbly";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: query
            ? `Search results for "${query}"`
            : "Search for movies and TV shows",
        },
      ],
    };
  },
});
