import { Tmdb } from '@/lib/tmdb'
import type { SearchResultsData } from '@/types/media'

export async function getSearchResult(
  query: string,
  page: number,
): Promise<SearchResultsData> {
  const url = `/search/multi?language=en-US&query=${query}&page=${
    page ? page : 1
  }`
  const result = await Tmdb<SearchResultsData>(url)

  if (result.error) {
    throw new Error(result.error)
  }

  if (!result.data?.results) {
    throw new Error('No data returned')
  }
  return result.data
}