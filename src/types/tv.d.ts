export interface BasicTv {
  adult: boolean
  backdrop_path: string
  created_by?: CreatedByEntity[] | null
  episode_run_time?: null[] | null
  first_air_date: string
  genres?: GenresEntity[] | null
  homepage: string
  id: number
  in_production: boolean
  languages?: string[] | null
  last_air_date: string
  last_episode_to_air: LastEpisodeToAir
  name: string
  next_episode_to_air: NextEpisodeToAir
  networks?: NetworksEntity[] | null
  number_of_episodes: number
  number_of_seasons: number
  origin_country?: string[] | null
  original_language: string
  original_name: string
  overview: string
  popularity: number
  poster_path: string
  production_companies?: ProductionCompaniesEntity[] | null
  production_countries?: ProductionCountriesEntity[] | null
  seasons?: SeasonsEntity[] | null
  spoken_languages?: SpokenLanguagesEntity[] | null
  status: string
  tagline: string
  type: string
  vote_average: number
  vote_count: number
}

export interface Tv {
  adult: boolean
  backdrop_path: string
  created_by?: CreatedByEntity[] | null
  episode_run_time?: null[] | null
  first_air_date: string
  genres?: GenresEntityOrResultsEntity[] | null
  homepage: string
  id: number
  in_production: boolean
  languages?: string[] | null
  last_air_date: string
  last_episode_to_air: LastEpisodeToAir
  name: string
  next_episode_to_air: NextEpisodeToAir
  networks?: NetworksEntity[] | null
  number_of_episodes: number
  number_of_seasons: number
  origin_country?: string[] | null
  original_language: string
  original_name: string
  overview: string
  popularity: number
  poster_path: string
  production_companies?: ProductionCompaniesEntity[] | null
  production_countries?: ProductionCountriesEntity[] | null
  seasons?: SeasonsEntity[] | null
  spoken_languages?: SpokenLanguagesEntity[] | null
  status: string
  tagline: string
  type: string
  vote_average: number
  vote_count: number
  external_ids: ExternalIds
  images: Images
  credits: Credits
  videos: Videos
  content_ratings: ContentRatings
  keywords: Keywords
}
export interface CreatedByEntity {
  id: number
  credit_id: string
  name: string
  original_name: string
  gender: number
  profile_path: string
}
export interface GenresEntityOrResultsEntity {
  id: number
  name: string
}
export interface LastEpisodeToAir {
  id: number
  name: string
  overview: string
  vote_average: number
  vote_count: number
  air_date: string
  episode_number: number
  episode_type: string
  production_code: string
  runtime: number
  season_number: number
  show_id: number
  still_path: string
}
export interface NextEpisodeToAir {
  id: number
  name: string
  overview: string
  vote_average: number
  vote_count: number
  air_date: string
  episode_number: number
  episode_type: string
  production_code: string
  runtime?: null
  season_number: number
  show_id: number
  still_path?: null
}
export interface NetworksEntity {
  id: number
  logo_path: string
  name: string
  origin_country: string
}
export interface ProductionCompaniesEntity {
  id: number
  logo_path?: null
  name: string
  origin_country: string
}
export interface ProductionCountriesEntity {
  iso_3166_1: string
  name: string
}
export interface SeasonsEntity {
  air_date: string
  episode_count: number
  id: number
  name: string
  overview: string
  poster_path: string
  season_number: number
  vote_average: number
}
export interface SpokenLanguagesEntity {
  english_name: string
  iso_639_1: string
  name: string
}
export interface ExternalIds {
  imdb_id: string
  freebase_mid?: null
  freebase_id?: null
  tvdb_id: number
  tvrage_id?: null
  wikidata_id: string
  facebook_id: string
  instagram_id: string
  twitter_id: string
}
export interface Images {
  backdrops?: BackdropsEntityOrPostersEntity[] | null
  logos?: LogosEntity[] | null
  posters?: BackdropsEntityOrPostersEntity[] | null
}
export interface BackdropsEntityOrPostersEntity {
  aspect_ratio: number
  height: number
  iso_639_1?: string | null
  file_path: string
  vote_average: number
  vote_count: number
  width: number
}
export interface LogosEntity {
  aspect_ratio: number
  height: number
  iso_639_1: string
  file_path: string
  vote_average: number
  vote_count: number
  width: number
}
export interface Credits {
  cast?: CastEntity[] | null
  crew?: CrewEntity[] | null
}
export interface CastEntity {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: string
  character: string
  credit_id: string
  order: number
}
export interface CrewEntity {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path?: string | null
  credit_id: string
  department: string
  job: string
}
export interface Videos {
  results?: ResultsEntity[] | null
}
export interface ResultsEntity {
  iso_639_1: string
  iso_3166_1: string
  name: string
  key: string
  site: string
  size: number
  type: string
  official: boolean
  published_at: string
  id: string
}
export interface ContentRatings {
  results?: ResultsEntity1[] | null
}
export interface ResultsEntity1 {
  descriptors?: null[] | null
  iso_3166_1: string
  rating: string
}
export interface Keywords {
  results?: GenresEntityOrResultsEntity[] | null
}
