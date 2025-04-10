export interface MediaListEntity {
  page: number;
  results?: MediaListResultsEntity[] | null;
  total_pages: number;
  total_results: number;
}
export interface MediaListResultsEntity {
  adult: boolean;
  backdrop_path: string;
  genre_ids?: number[] | null;
  id: number;
  origin_country?: string[] | null;
  original_language: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  popularity: number;
  poster_path?: string;
  profile_path?: string;
  first_air_date?: string;
  release_date?: string;
  title?: string;
  name?: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  known_for_department?: string;
  media_type: string;
}

export interface SearchResultsData {
  page: number;
  results?: SearchResultsEntity[] | null;
  total_pages: number;
  total_results: number;
}
type KnownForEntity = MediaListResultsEntity;

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

export interface MediaListQuery {
  type:
    | "popular_movie"
    | "popular_tv"
    | "top_rated_movie"
    | "top_rated_tv"
    | "trending_day"
    | "trending_week"
    | "upcoming_movie";
  page?: number;
}

export interface MediaListDataQuery {
  type:
    | "movies_popular"
    | "movies_now-playing"
    | "movies_top-rated"
    | "movies_upcoming"
    | "tv-shows_popular"
    | "tv-shows_on-the-air"
    | "tv-shows_top-rated"
    | "tv-shows_airing-today"
    | "peoples_popular";
  page: number;
}
