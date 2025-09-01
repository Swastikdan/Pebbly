import { type Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@heroui/spinner";

import { ExportAndAddWatchlist } from "@/components/export-and-add-watchlist";
import { WatchListContainer } from "@/components/watchlist-contatiner";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Your saved movies and TV shows",
};

export default function WatchlistPage() {
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
