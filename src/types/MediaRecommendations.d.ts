export interface MediaRecommendations {
  page: number
  results?: ResultsEntity[] | null
  total_pages: number
  total_results: number
}
export interface ResultsEntity {
  backdrop_path?: string | null
  id: number
  title?: string
  name?: string
  original_name?: string
  original_title?: string
  overview: string
  poster_path: string
  media_type: string
  adult: boolean
  original_language: string
  genre_ids?: number[] | null
  popularity: number
  release_date?: string
  first_air_date?: string
  video: boolean
  vote_average: number
  vote_count: number
  origin_country?: string[] | null
}
