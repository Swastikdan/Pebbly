import {
  MediaImages,
  BackdropsEntityOrLogosEntityOrPostersEntity,
} from '@/types/MediaImages'
import { Tmdb } from '@/lib/tmdb'

export async function getImages({
  id,
  type,
}: {
  id: number
  type: 'movie' | 'tv'
}): Promise<MediaImages> {
  const url = `/${type}/${id}/images`
  const result = await Tmdb<MediaImages>(url)
  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.data) {
    throw new Error('No data returned')
  }

  return result.data
}
