"use server";
import { Tmdb } from "@/server/tmdb";
import { SearchResult, SearchResultsEntity } from "@/types";

export async function getSearchResult(
  query: string,
  page: number
): Promise<{ results: SearchResultsEntity[]; total_pages: number }> {
  const url = `/search/multi?language=en-US&query=${query}&page=${
    page ? page : 1
  }`;
  const result = await Tmdb<SearchResult>(url);

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.data || !result.data.results) {
    throw new Error("No data returned");
  }

  // const sortedResults = result.data.results.sort(
  //   (a: SearchResultsEntity, b: SearchResultsEntity) => {
  //     return b.popularity - a.popularity;
  //   }
  // );

  return { results: result.data.results, total_pages: result.data.total_pages };
}
