import { useQueries } from "@tanstack/react-query";

import type { MediaType } from "@/domain/media";
import type {
  BasicMovie,
  BasicTv,
  MediaListResultsEntity,
} from "@/lib/tmdb-schemas";
import { MediaSkeletonList } from "@/components/media-skeleton-list";
import { useContinueWatching } from "@/hooks/watch-progress/use-watch-progress";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { MediaList, MediaSection } from "./homepage-media";

interface MediaListProps extends MediaListResultsEntity {
  is_on_watchlist_page?: boolean;
  is_on_homepage?: boolean;
  isContinueWatching?: boolean;
}

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

export function ContinueWatching() {
  const { items } = useContinueWatching();

  if (items.length === 0) return null;

  return <ContinueWatchingContent items={items} />;
}

function ContinueWatchingContent({
  items,
}: {
  items: {
    id: string;
    type: MediaType;
    percent: number;
    title?: string;
    image?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
  }[];
}) {
  const queries = items.map((item) => ({
    queryKey:
      item.type === "movie"
        ? queryKeys.tmdb.basicMovieDetails(Number(item.id))
        : queryKeys.tmdb.basicTvDetails(Number(item.id)),
    queryFn: () =>
      item.type === "movie"
        ? getBasicMovieDetails({ id: Number(item.id) })
        : getBasicTvDetails({ id: Number(item.id) }),
    staleTime: 1000 * 60 * 30,
    enabled: !item.title || !item.overview,
  }));

  const results = useQueries({ queries });

  const isLoading = results.some((r, i) => queries[i].enabled && r.isLoading);
  const hasError = results.some((r, i) => queries[i].enabled && r.isError);

  if (isLoading) return <MediaSkeletonList cardType="vertical" />;
  if (hasError) return null;

  const mediaItems = results
    .map((r, i) => {
      const data = r.data;
      const item = items[i];

      const title =
        item.title ??
        (data
          ? item.type === "movie"
            ? (data as BasicMovie).title
            : (data as BasicTv).name
          : undefined);
      const overview = item.overview ?? data?.overview;

      if (!title || !overview) return null;

      const raw = data as unknown as Record<string, unknown>;
      const result: MediaListProps = {
        id: Number(item.id),
        title,
        vote_average: item.rating ?? (raw?.vote_average as number) ?? 0,
        vote_count: (raw?.vote_count as number) ?? 0,
        poster_path: item.image ?? (raw?.poster_path as string) ?? "",
        backdrop_path: item.image ?? (raw?.backdrop_path as string) ?? "",
        overview,
        media_type: item.type,
        adult: (raw?.adult as boolean) ?? false,
        original_language: (raw?.original_language as string) ?? "",
        popularity: (raw?.popularity as number) ?? 0,
        video: (raw?.video as boolean) ?? false,
        isContinueWatching: true,
      };

      return result;
    })
    .filter(Boolean) as MediaListProps[];

  if (mediaItems.length === 0) return null;

  return <MediaList data={mediaItems} cardType="vertical" />;
}
