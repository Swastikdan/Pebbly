import { MediaSection } from "./homepage-media";

export function TrendingWeekMovies() {
  return <MediaSection queryType="trending_week" />;
}

export function UpcomingMovies() {
  return (
    <MediaSection
      queryType="movies_upcoming"
      cardTypeOverride="horizontal"
      mediaType="movie"
    />
  );
}

export function PopularMovies() {
  return <MediaSection queryType="movies_popular" mediaType="movie" />;
}

export function PopularTv() {
  return <MediaSection queryType="tv-shows_popular" mediaType="tv" />;
}

export function TopRatedMovies() {
  return <MediaSection queryType="movies_top-rated" mediaType="movie" />;
}

export function TopRatedTv() {
  return <MediaSection queryType="tv-shows_top-rated" mediaType="tv" />;
}
