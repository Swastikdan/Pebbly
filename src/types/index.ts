export interface MediaEntity {
  dates?: Dates;
  page: number;
  results?: ResultsEntity[] | null;
  total_pages: number;
  total_results: number;
}
export interface Dates {
  maximum: string;
  minimum: string;
}
export interface ResultsEntity {
  backdrop_path: string;
  id: number;
  name?: string | null;
  original_name?: string | null;
  overview: string;
  poster_path: string;
  media_type: string;
  adult: boolean;
  original_language: string;
  genre_ids?: number[] | null;
  popularity: number;
  first_air_date?: string | null;
  vote_average: number;
  vote_count: number;
  origin_country?: string[] | null;
  title?: string | null;
  original_title?: string | null;
  release_date?: string | null;
  video?: boolean | null;
}
export interface WatchList {
  title: string;
  type: 'movie' | 'tv';
  externalId: string;
  image?: string;
  rating?: number;
  releaseDate?: string;
}

export interface SearchResult {
  page: number;
  results?: ResultsEntity[] | null;
  total_pages: number;
  total_results: number;
}
export interface SearchResultsEntity {
  backdrop_path?: string | null;
  id: number;
  title?: string | null;
  original_title?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  media_type: string;
  adult: boolean;
  original_language?: string | null;
  genre_ids?: (number | null)[] | null;
  popularity: number;
  release_date?: string | null;
  video?: boolean | null;
  vote_average?: number | null;
  vote_count?: number | null;
  name?: string | null;
  original_name?: string | null;
  gender?: number | null;
  known_for_department?: string | null;
  profile_path?: string | null;
  known_for?: (KnownForEntity | null)[] | null;
  first_air_date?: string | null;
  origin_country?: string[] | null;
}
export interface KnownForEntity {
  backdrop_path: string;
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string;
  media_type: string;
  adult: boolean;
  original_language: string;
  genre_ids?: null[] | null;
  popularity: number;
  release_date: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export interface MovieDetail {
  adult: boolean;
  backdrop_path: string;
  belongs_to_collection: MovieBelongsToCollection;
  budget: number;
  genres?: MovieGenresEntityOrKeywordsEntity[] | null;
  homepage: string;
  id: number;
  imdb_id: string;
  origin_country?: string[] | null;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  production_companies?: MovieProductionCompaniesEntity[] | null;
  production_countries?: MovieProductionCountriesEntity[] | null;
  release_date: string;
  revenue: number;
  runtime: number;
  spoken_languages?: MovieSpokenLanguagesEntity[] | null;
  status: string;
  tagline: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  external_ids: MovieExternalIds;
  images: MovieImages;
  credits: MovieCredits;
  videos: MovieVideos;
  release_dates: MovieReleaseDates;
  keywords: MovieKeywords;
}

export interface MovieBelongsToCollection {
  id: number;
  name: string;
  poster_path: string;
  backdrop_path: string;
}

export interface MovieGenresEntityOrKeywordsEntity {
  id: number;
  name: string;
}

export interface MovieProductionCompaniesEntity {
  id: number;
  logo_path: string;
  name: string;
  origin_country: string;
}

export interface MovieProductionCountriesEntity {
  iso_3166_1: string;
  name: string;
}

export interface MovieSpokenLanguagesEntity {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface MovieExternalIds {
  imdb_id: string;
  wikidata_id: string;
  facebook_id: string;
  instagram_id: string;
  twitter_id: string;
}

export interface MovieImages {
  backdrops?: null[] | null;
  logos?: null[] | null;
  posters?: null[] | null;
}

export interface MovieCredits {
  cast?: MovieCastEntity[] | null;
  crew?: MovieCrewEntity[] | null;
}

export interface MovieCastEntity {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path?: string | null;
  cast_id: number;
  character: string;
  credit_id: string;
  order: number;
}

export interface MovieCrewEntity {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path?: string | null;
  credit_id: string;
  department: string;
  job: string;
}

export interface MovieVideos {
  results?: MovieResultsEntity[] | null;
}

export interface MovieResultsEntity {
  iso_639_1: string;
  iso_3166_1: string;
  name: string;
  key: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
  published_at: string;
  id: string;
}

export interface MovieReleaseDates {
  results?: MovieResultsEntity1[] | null;
}

export interface MovieResultsEntity1 {
  iso_3166_1: string;
  release_dates?: MovieReleaseDatesEntity[] | null;
}

export interface MovieReleaseDatesEntity {
  certification: string;
  descriptors?: (string | null)[] | null;
  iso_639_1: string;
  note: string;
  release_date: string;
  type: number;
}

export interface MovieKeywords {
  keywords?: MovieGenresEntityOrKeywordsEntity[] | null;
}
