import React from "react";
import type { Metadata } from "next";
import { Searchbar } from "@/components/SearchBar";
import SearchResults from "./SearchResults";
import { MediaCardSkeleton } from "@/components/MediaCard";
import { Suspense } from "react";
import { QueryClient } from "@tanstack/react-query";
import { getSearchResult } from "@/server/getSearchResult";
type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const query = (await searchParams).query;
  if (!query || (Array.isArray(query) && query.length === 0)) {
    return {
      title: "Search",
      description: "Search for movies and TV shows",
    };
  }
  return {
    title: `Search results for ${query}`,
    description: `Search results for ${query}`,
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const queryParam = (await searchParams).query;
  const query = Array.isArray(queryParam)
    ? queryParam.join(" ")
    : queryParam || "";
  const pageParam = (await searchParams).page;
  const page = parseInt(
    Array.isArray(pageParam) ? pageParam[0] : (pageParam ?? "1")
  );
  const queryClient = new QueryClient();

  queryClient.prefetchQuery({
    queryKey: ["search", query, page],
    queryFn: async () => await getSearchResult(query, page),
    staleTime: 24 * 1000 * 60 * 60,
  });
  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-screen-xl p-5">
        <Searchbar searchterm={query} />
        <div className="w-full py-5">
          <Suspense
            fallback={
              <div className="grid w-full grid-cols-2 items-center justify-center gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, index) => (
                  <MediaCardSkeleton key={index} />
                ))}
              </div>
            }
          >
            <SearchResults />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
