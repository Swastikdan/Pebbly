export interface Collection {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  parts?: PartsEntity[] | null;
}
export interface PartsEntity {
  backdrop_path: string;
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string;
  media_type: string;
  adult: boolean;
  original_language: string;
  genre_ids?: number[] | null;
  popularity: number;
  release_date: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}
