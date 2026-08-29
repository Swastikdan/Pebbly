export interface MediaQuery {
  type:
    | "trending_day"
    | "trending_week"
    | "movies_upcoming"
    | "movies_popular"
    | "tv-shows_popular"
    | "movies_top-rated"
    | "tv-shows_top-rated";
  page?: number;
}

export interface MediaListQuery {
  type:
    | "movies_popular"
    | "movies_now-playing"
    | "movies_top-rated"
    | "movies_upcoming"
    | "tv-shows_popular"
    | "tv-shows_on-the-air"
    | "tv-shows_top-rated"
    | "tv-shows_airing-today";

  page: number;
}
