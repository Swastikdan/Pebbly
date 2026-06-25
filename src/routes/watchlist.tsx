import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/watchlist")({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			tab: (search.tab as string | undefined) || undefined,
		};
	},
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
