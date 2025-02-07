export interface TvSeasons {
  _id: string
  air_date: string
  episodes?: EpisodesEntity[] | null
  name: string
  overview: string
  id: number
  poster_path: string
  season_number: number
  vote_average: number
}
export interface EpisodesEntity {
  air_date: string
  episode_number: number
  episode_type: string
  id: number
  name: string
  overview: string
  production_code: string
  runtime?: null
  season_number: number
  show_id: number
  still_path?: null
  vote_average: number
  vote_count: number
  crew?: null[] | null
  guest_stars?: (GuestStarsEntity | null)[] | null
}
export interface GuestStarsEntity {
  character: string
  credit_id: string
  order: number
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path?: string | null
}
