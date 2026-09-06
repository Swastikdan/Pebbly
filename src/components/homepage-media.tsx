import { memo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { MediaType } from "@/domain/media";
import type { MediaListResultsEntity } from "@/lib/tmdb-schemas";
import { MediaCard } from "@/components/media-card";
import { MediaSkeletonList } from "@/components/media-skeleton-list";
import { ScrollContainer } from "@/components/scroll-container";
import { getMedia } from "@/lib/queries";
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
        <div className="flex gap-2 p-4 first:ps-0 last:pe-0">
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

export { MediaList, MediaSection, TrendingDayMovies };
