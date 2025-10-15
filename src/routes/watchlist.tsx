import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ExportAndAddWatchlist } from "@/components/export-and-add-watchlist";
import { Spinner } from "@/components/ui/spinner";
import { WatchListContainer } from "@/components/watchlist-contatiner";
export const Route = createFileRoute("/watchlist")({
	head: () => ({
		meta: [
			{ title: "Watchlist | Film Fanatic" },
			{
				name: "description",
				content: "Your saved movies and TV shows.",
			},
		],
	}),
	component: WatchlistPage,
});

function WatchlistPage() {
	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="top-0 w-full max-w-screen-xl items-center justify-center p-5">
				<h1 className="text-start text-4xl font-bold">Watchlist</h1>
				<p className="mt-2 text-start text-lg">
					Your saved movies and TV shows
				</p>
				<ExportAndAddWatchlist />
				<Suspense fallback={<Spinner />}>
					<WatchListContainer />
				</Suspense>
			</div>
		</section>
	);
}
