export interface Movie {
  adult: boolean
  backdrop_path: string
  belongs_to_collection: BelongsToCollection
  budget: number
  genres?: GenresEntityOrKeywordsEntity[] | null
  homepage: string
  id: number
  imdb_id: string
  origin_country?: string[] | null
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string
  production_companies?: ProductionCompaniesEntity[] | null
  production_countries?: ProductionCountriesEntity[] | null
  release_date: string
  revenue: number
  runtime: number
  spoken_languages?: SpokenLanguagesEntity[] | null
  status: string
  tagline: string
  title: string
  video: boolean
  vote_average: number
  vote_count: number
  external_ids: ExternalIds
  images: Images
  credits: Credits
  videos: Videos
  release_dates: ReleaseDates
  keywords: Keywords
}
export interface BasicMovie {
  adult: boolean
  backdrop_path: string
  belongs_to_collection: BelongsToCollection
  budget: number
  genres?: GenresEntity[] | null
  homepage: string
  id: number
  imdb_id: string
  origin_country?: string[] | null
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string
  production_companies?: ProductionCompaniesEntity[] | null
  production_countries?: ProductionCountriesEntity[] | null
  release_date: string
  revenue: number
  runtime: number
  spoken_languages?: SpokenLanguagesEntity[] | null
  status: string
  tagline: string
  title: string
  video: boolean
  vote_average: number
  vote_count: number
}

export interface BelongsToCollection {
  id: number
  name: string
  poster_path: string
  backdrop_path: string
}
export interface GenresEntityOrKeywordsEntity {
  id: number
  name: string
}
export interface ProductionCompaniesEntity {
  id: number
  logo_path: string
  name: string
  origin_country: string
}
export interface ProductionCountriesEntity {
  iso_3166_1: string
  name: string
}
export interface SpokenLanguagesEntity {
  english_name: string
  iso_639_1: string
  name: string
}
export interface ExternalIds {
  imdb_id: string
  wikidata_id: string
  facebook_id: string
  instagram_id: string
  twitter_id: string
}
export interface Images {
  backdrops?: BackdropsEntityOrLogosEntityOrPostersEntity[] | null
  logos?: BackdropsEntityOrLogosEntityOrPostersEntity[] | null
  posters?: BackdropsEntityOrLogosEntityOrPostersEntity[] | null
}
export interface BackdropsEntityOrLogosEntityOrPostersEntity {
  aspect_ratio: number
  height: number
  iso_639_1?: string | null
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
  profile_path?: string | null
  cast_id: number
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
export interface ReleaseDates {
  results?: ResultsEntity1[] | null
}
export interface ResultsEntity1 {
  iso_3166_1: string
  release_dates?: ReleaseDatesEntity[] | null
}
export interface ReleaseDatesEntity {
  certification: string
  descriptors?: (string | null)[] | null
  iso_639_1: string
  note: string
  release_date: string
  type: number
}
export interface Keywords {
  keywords?: GenresEntityOrKeywordsEntity[] | null
}
