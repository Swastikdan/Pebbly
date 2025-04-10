import React from "react";
import type { Metadata } from "next";
import { Searchbar } from "@/components/search/search-bar";
import SearchResults from "@/components/search/search-results";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function normalizeQuery(rawQuery: string | string[] | undefined): string {
  if (!rawQuery) return "";
  return Array.isArray(rawQuery) ? rawQuery.join(" ") : rawQuery;
}

export async function generateMetadata(props: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const query = searchParams.query;

  // Ensure query is a string (join if it's an array)
  const queryString = normalizeQuery(query);

  if (!queryString || queryString.length === 0) {
    return {
      title: "Search",
      description: "Search for movies and TV shows",
    };
  }

  return {
    title: `Search results for ${queryString}`,
    description: `Search results for ${queryString}`,
  };
}
export default async function SearchPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.query;

  // Ensure query is a string (join if it's an array)
  const queryString = normalizeQuery(query);
  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-screen-xl p-5">
        <Searchbar searchterm={queryString} />

        <div className="w-full py-5">
          <SearchResults />
        </div>
      </div>
    </section>
  );
}
