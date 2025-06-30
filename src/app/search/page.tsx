import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Searchbar, SearchBarSkeleton } from "@/components/search-bar";
import { SearchResults } from "@/components/search-results";

export const metadata: Metadata = {
  title: "Search Results | Film Fanatic",
  description: "Search for movies and TV shows",
};
export default async function SearchPage() {
  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-screen-xl p-5">
        <Suspense fallback={<SearchBarSkeleton />}>
          <Searchbar />
        </Suspense>
        <Suspense fallback={<div className="h-[80vh] w-full py-5"></div>}>
          <div className="w-full py-5">
            <SearchResults />
          </div>
        </Suspense>
      </div>
    </section>
  );
}
