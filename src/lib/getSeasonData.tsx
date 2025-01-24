import { TvSeasons, EpisodesEntity } from '@/types/TvSeasons'
import { Tmdb } from '@/lib/tmdb'

export async function geSeasonData({
  id,
  season,
}: {
  id: number
  season: number
}): Promise<TvSeasons> {
  const url = `/tv/${id}/season/${season}`
  const result = await Tmdb<TvSeasons>(url)

  if (result.error) {
    throw new Error(result.error)
  }

  if (!result.data) {
    throw new Error('No data returned')
  }

  return result.data
}
