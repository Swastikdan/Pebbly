import { MediaCredits } from '@/types/MediaCredits'
import { Tmdb } from '@/lib/tmdb'
export async function getCredits({
  id,
  type,
}: {
  id: number
  type: 'movie' | 'tv'
}): Promise<MediaCredits> {
  const url = `/${type}/${id}/credits`
  const result = await Tmdb<MediaCredits>(url)
  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.data) {
    throw new Error('No data returned')
  }

  return result.data
}
