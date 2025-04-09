import { Tmdb } from '@/lib/tmdb'
import type { Collection } from '@/types/mediacollection'

export async function getCollection({
  id,
}: {
  id: number
}): Promise<Collection> {
  if (id < -2147483648 || id > 2147483647) {
    throw new Error('Invalid ID')
  }
  const url = `/collection/${id}?&language=en-US&include_adult=true`
  const result = await Tmdb<Collection>(url)

  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.data) {
    throw new Error('No data found')
  }

  return result.data
}