import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { z } from "zod";
import { SearchResults } from "@/components/search-results";
import { SearchBar, SearchBarSkeleton } from "@/components/ui/search-bar";

const searchPageSearchSchema = z.object({
	page: z.number().optional(),
	query: z.string().optional(),
});

export const Route = createFileRoute("/search")({
	validateSearch: searchPageSearchSchema,
	head: () => ({
		meta: [
			{ title: "Search Results | Film Fanatic" },
			{
				name: "description",
				content: "Search for movies and TV shows",
			},
		],
	}),
	component: SearchPage,
});

function SearchPage() {
	const { query } = Route.useSearch();
	return (
		<section className="flex w-full justify-center">
			<div className="mx-auto w-full max-w-screen-xl p-5">
				<Suspense fallback={<SearchBarSkeleton />}>
					<SearchBar query={query} updateUrlOnChange />
				</Suspense>
				<Suspense fallback={<div className="h-[80vh] w-full py-5" />}>
					<div className="w-full py-5">
						<SearchResults />
					</div>
				</Suspense>
			</div>
		</section>
	);
}
