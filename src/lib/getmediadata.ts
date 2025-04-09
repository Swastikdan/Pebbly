import { Tmdb } from '@/lib/tmdb'
import type {
  MediaListDataQuery,
  MediaListEntity,
} from '@/types/media'

export async function getMediaData({
  type,
  page,
}: MediaListDataQuery): Promise<MediaListEntity> {
  const pagenumber: number = page ? page : 1
  let url = ''
  switch (type) {
    case 'movies_popular':
      url = `/movie/popular?language=en-US&page=${pagenumber}`
      break
    case 'movies_now-playing':
      url = `/movie/now_playing?language=en-US&page=${pagenumber}`
      break
    case 'movies_top-rated':
      url = `/movie/top_rated?language=en-US&page=${pagenumber}`
      break
    case 'movies_upcoming':
      url = `/movie/upcoming?language=en-US&page=${pagenumber}`
      break
    case 'tv-shows_airing-today':
      url = `/tv/airing_today?language=en-US&page=${pagenumber}`
      break
    case 'tv-shows_on-the-air':
      url = `/tv/on_the_air?language=en-US&page=${pagenumber}`
      break
    case 'tv-shows_popular':
      url = `/tv/popular?language=en-US&page=${pagenumber}`
      break
    case 'tv-shows_top-rated':
      url = `/tv/top_rated?language=en-US&page=${pagenumber}`
      break
    case 'peoples_popular':
      url = `/person/popular?language=en-US&page=${pagenumber}`
      break
  }

  const result = await Tmdb<MediaListEntity>(url)
  if (result.error) {
    throw new Error(result.error)
  }
  if (!result.data?.results) {
    throw new Error('No data returned')
  }

  return result.data
}