// https://api.themoviedb.org/3/movie/movie_id/recommendations?language=en-US&page=1
import { MediaRecommendations } from '@/types/MediaRecommendations'
import { Tmdb } from '@/lib/tmdb'
export async function getRecommendations({
  type,
  id,
  page,
}: {
  type: string
  id: number
  page: number
}) {
  const url = `/${type}/${id}/recommendations?language=en-US&page=${page}`
  const result = await Tmdb<MediaRecommendations>(url)
  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.data || !result.data.results) {
    throw new Error('No data returned')
  }
  return result.data
}
// import { Tmdb } from '@/lib/tmdb'
// import { SearchResultsData } from '@/types/media'

// export async function getSearchResult(
//   query: string,
//   page: number,
// ): Promise<SearchResultsData> {
//   const url = `/search/multi?language=en-US&query=${query}&page=${
//     page ? page : 1
//   }`
//   const result = await Tmdb<SearchResultsData>(url)

//   if (result.error) {
//     throw new Error(result.error)
//   }

//   if (!result.data || !result.data.results) {
//     throw new Error('No data returned')
//   }
//   return result.data
// }
