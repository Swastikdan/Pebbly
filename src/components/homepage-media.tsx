import { memo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import type { MediaType } from "@/domain/media";
import type {
  BasicMovie,
  BasicTv,
  MediaListResultsEntity,
} from "@/lib/tmdb-schemas";
import { MediaCard } from "@/components/media-card";
import { MediaSkeletonList } from "@/components/media-skeleton-list";
import { ScrollContainer } from "@/components/scroll-container";
import { useContinueWatching } from "@/hooks/watch-progress/use-watch-progress";
import {
  getBasicMovieDetails,
  getBasicTvDetails,
  getMedia,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

interface MediaListProps extends MediaListResultsEntity {
  is_on_watchlist_page?: boolean;
  is_on_homepage?: boolean;
  isContinueWatching?: boolean;
}
const MediaList = memo(
  (props: {
    data: MediaListProps[];
    cardType?: "horizontal" | "vertical";
    defaultMediatype?: MediaType;
    priorityCount?: number;
  }) => {
    return (
      <ScrollContainer isButtonsVisible={true}>
        <div className="flex gap-2 p-4 first:pl-0 last:pr-0">
          {props.data.map((item, index) => (
            <MediaCard
              key={item.id}
              id={item.id}
              title={item.title ?? item.name ?? "Untitled"}
              rating={item.vote_average}
              image={
                props.cardType === "vertical"
                  ? (item.backdrop_path ?? "")
                  : (item.poster_path ?? "")
              }
              poster_path={item.poster_path}
              media_type={
                props.defaultMediatype ??
                (item.media_type === "tv" ? "tv" : "movie")
              }
              release_date={item.first_air_date ?? item.release_date ?? null}
              is_on_watchlist_page={item.is_on_watchlist_page}
              is_on_homepage={item.is_on_homepage}
              isContinueWatching={item.isContinueWatching}
              card_type={props.cardType as unknown as "horizontal" | "vertical"}
              overview={item.overview}
              priority={
                props.priorityCount ? index < props.priorityCount : false
              }
            />
          ))}
        </div>
      </ScrollContainer>
    );
  },
);

const useMediaQuery = (
  type:
    | "trending_day"
    | "trending_week"
    | "movies_upcoming"
    | "movies_popular"
    | "tv-shows_popular"
    | "movies_top-rated"
    | "tv-shows_top-rated",
  options?: {
    cardType?: "horizontal" | "vertical";
    mediaType?: MediaType;
  },
) => {
  const { data, isFetching, error } = useQuery({
    queryKey:
      type === "trending_day"
        ? queryKeys.tmdb.trendingDay()
        : queryKeys.tmdb.homepageMedia(type),
    queryFn: () => getMedia({ type }),
  });

  return {
    data,
    isFetching,
    error,
    cardType: options?.cardType ?? "horizontal",
    mediaType: options?.mediaType,
  };
};

function MediaSection({
  queryType,
  cardTypeOverride,
  mediaType,
  priorityCount,
}: {
  queryType:
    | "trending_day"
    | "trending_week"
    | "movies_upcoming"
    | "movies_popular"
    | "tv-shows_popular"
    | "movies_top-rated"
    | "tv-shows_top-rated";
  cardTypeOverride?: "horizontal" | "vertical";
  mediaType?: MediaType;
  priorityCount?: number;
}) {
  const { data, error, cardType } = useMediaQuery(queryType, {
    cardType: cardTypeOverride,
    mediaType,
  });

  if (!data || error) return <MediaSkeletonList cardType={cardType} />;
  return (
    <MediaList
      data={data ?? []}
      cardType={cardType}
      defaultMediatype={mediaType}
      priorityCount={priorityCount}
    />
  );
}

function TrendingDayMovies() {
  return <MediaSection queryType="trending_day" priorityCount={2} />;
}

function TrendingWeekMovies() {
  return <MediaSection queryType="trending_week" />;
}

function UpcomingMovies() {
  // Fixed to horizontal (poster) to avoid CLS: the previous implementation
  // flipped between horizontal (poster) and vertical (backdrop) based on
  // whether Continue Watching was visible, which is only known after
  // client auth hydration. That caused a ~100px height shift on every
  // signed-in navigation.
  return (
    <MediaSection
      queryType="movies_upcoming"
      cardTypeOverride="horizontal"
      mediaType="movie"
    />
  );
}

function PopularMovies() {
  return <MediaSection queryType="movies_popular" mediaType="movie" />;
}

function PopularTv() {
  return <MediaSection queryType="tv-shows_popular" mediaType="tv" />;
}

function TopRatedMovies() {
  return <MediaSection queryType="movies_top-rated" mediaType="movie" />;
}

function TopRatedTv() {
  return <MediaSection queryType="tv-shows_top-rated" mediaType="tv" />;
}

function ContinueWatching() {
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
    // Reuse the canonical basic-details cache: identical payload to the old
    // continue-watching key, shared with every other basic-details consumer.
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

      // Skip items missing required fields
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

export {
  ContinueWatching,
  PopularMovies,
  PopularTv,
  TopRatedMovies,
  TopRatedTv,
  TrendingDayMovies,
  TrendingWeekMovies,
  UpcomingMovies,
};
