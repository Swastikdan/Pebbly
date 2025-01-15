import { Tmdb } from '@/lib/tmdb'
import type { BasicMovie, Movie } from '@/types/movie'

export async function getBasicMovieDetails({
  id,
}: {
  id: number
}): Promise<BasicMovie> {
  if (id < -2147483648 || id > 2147483647) {
    throw new Error('Invalid ID')
  }
  const url = `/movie/${id}?&include_adult=true`
  const result = await Tmdb<BasicMovie>(url)

  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.data) {
    throw new Error('No data found')
  }

  return result.data
}

export async function getMovieDetails({ id }: { id: number }): Promise<Movie> {
  if (id < -2147483648 || id > 2147483647) {
    throw new Error('Invalid ID')
  }
  const url = `/movie/${id}?include_adult=true&append_to_response=external_ids,images,credits,image,videos,collections,release_dates,recommendations,keywords`
  const result = await Tmdb<Movie>(url)

  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.data) {
    throw new Error('No data found')
  }

  return result.data
}
