import { createFileRoute } from "@tanstack/react-router";
import { number, object, optional, string } from "valibot";

const searchPageSearchSchema = object({
	page: optional(number()),
	query: optional(string()),
});

export const Route = createFileRoute("/search")({
	validateSearch: searchPageSearchSchema,
	head: () => ({
		meta: [
			{ title: "Search Results | Pebbly" },
			{
				name: "description",
				content: "Search for movies and TV shows",
			},
		],
	}),
});
