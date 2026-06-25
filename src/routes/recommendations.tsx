import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/recommendations")({
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
	validateSearch: (search: Record<string, unknown>) => {
		return {
			activeId: search.activeId as string | undefined,
		};
	},
});
