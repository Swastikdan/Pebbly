import { Tmdb } from '@/lib/tmdb'
import {
  MovieRecommendations,
  MovieRecommendationsResultsEntity,
  TvRecommendations,
  TvRecommendationsResultsEntity,
} from '@/types/recommendations'

export async function getMovieRecommendations({
  id,
}: {
  id: number
}): Promise<MovieRecommendationsResultsEntity[]> {
  if (id < -2147483648 || id > 2147483647) {
    throw new Error('Invalid ID')
  }

  const url = `/movie/${id}/recommendations?&language=en-US`

  const result = await Tmdb<MovieRecommendations>(url)

  if (result.error) {
    throw new Error(result.error)
  }

  return result?.data?.results || []
}

export async function getTvSeriesRecommendations({
  id,
}: {
  id: number
}): Promise<TvRecommendationsResultsEntity[]> {
  if (id < -2147483648 || id > 2147483647) {
    throw new Error('Invalid ID')
  }

  const url = `/tv/${id}/recommendations?&language=en-US`

  const result = await Tmdb<TvRecommendations>(url)

  if (result.error) {
    throw new Error(result.error)
  }

  return result?.data?.results || []
}

// export async function getTvSeriesRecommendations({ id }: { id: number }) {
//   if (id < -2147483648 || id > 2147483647) {
//     throw new Error('Invalid ID')
//   }

//   const url = `/tv/${id}/recommendations?&language=en-US`

//   //const result = await Tmdb<TvSeriesRecommendationsResultsEntity[]>(url);
//   const result = await Tmdb<{
//     page: number
//     results?: TvSeriesRecommendationsResultsEntity[] | null
//     total_pages: number
//     total_results: number
//   }>(url)
//   if (result.error) {
//     throw new Error(result.error)
//   }
//   if (!result.data) {
//     throw new Error('No data found')
//   }

//   return result.data.results
// }
