import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { MediaType } from "@/domain/media";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
import { useRecommendationCardFeedback } from "@/hooks/use-recommendation-card-feedback";
import {
  getMovieRecommendations,
  getTvSeriesRecommendations,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

export const MediaRecommendations = (props: {
  id: number;
  urltitle: string;
  type: MediaType;
}) => {
  const { id, type } = props;
  const { isLiked, isDisliked, handleMoreLikeThis, handleNotThis } =
    useRecommendationCardFeedback();

  const {
    data: movie_data,
    isLoading: movie_is_loading,
    isError: movie_is_error,
  } = useQuery({
    queryKey: queryKeys.tmdb.recommendations("movie", id),
    queryFn: async () => await getMovieRecommendations({ id }),
    enabled: type === "movie",
  });
  const {
    data: tv_data,
    isLoading: tv_is_loading,
    isError: tv_is_error,
  } = useQuery({
    queryKey: queryKeys.tmdb.recommendations("tv", id),
    queryFn: async () => await getTvSeriesRecommendations({ id: id }),
    enabled: type === "tv",
  });

  const movieResults = useMemo(
    () =>
      movie_data?.results?.filter((item) => !isDisliked(item.id, "movie")) ??
      [],
    [movie_data?.results, isDisliked],
  );

  const tvResults = useMemo(
    () => tv_data?.results?.filter((item) => !isDisliked(item.id, "tv")) ?? [],
    [tv_data?.results, isDisliked],
  );

  const isLoading = movie_is_loading || tv_is_loading;
  const isError = movie_is_error || tv_is_error;
  if (isLoading || isError) {
    return (
      <div className="pb-5">
        <div className="flex flex-col gap-3">
          <h2 className="font-heading w-fit text-xl font-semibold md:text-2xl">
            Recommendations
          </h2>
          <ScrollContainer isButtonsVisible={false}>
            <div className="flex gap-4 p-4 first:ps-0 last:pe-0">
              {Array.from({ length: 6 }).map((_, index) => (
                <MediaCardSkeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
                  key={index}
                  card_type="vertical"
                />
              ))}
            </div>
          </ScrollContainer>
        </div>
      </div>
    );
  }

  const hasMediaRecommendations =
    (type === "movie" ? movieResults.length : tvResults.length) > 0;
  if (!hasMediaRecommendations) return null;

  return (
    <div className="pb-5">
      <div className="flex flex-col gap-3">
        <h2 className="font-heading w-fit text-xl font-semibold md:text-2xl">
          Recommendations
        </h2>
        <ScrollContainer isButtonsVisible={!movie_is_loading}>
          <div className="flex gap-4 p-4 first:ps-0 last:pe-0">
            {type === "movie"
              ? movieResults.map((item) => (
                  <MediaCard
                    key={item.id}
                    card_type="vertical"
                    id={item.id}
                    image={item.backdrop_path ?? undefined}
                    media_type="movie"
                    poster_path={item.poster_path ?? undefined}
                    rating={item.vote_average}
                    release_date={item.release_date}
                    title={item.title}
                    overview={item.overview}
                    hideWatchlistButton={true}
                    feedbackActions={{
                      isLiked: isLiked(item.id, "movie"),
                      isDisliked: isDisliked(item.id, "movie"),
                      onMoreLikeThis: () =>
                        handleMoreLikeThis({
                          id: item.id,
                          mediaType: "movie",
                          title: item.title,
                          image: item.poster_path ?? undefined,
                          rating: item.vote_average,
                          release_date: item.release_date ?? undefined,
                          overview: item.overview,
                        }),
                      onNotThis: () =>
                        handleNotThis({
                          id: item.id,
                          mediaType: "movie",
                          title: item.title,
                          image: item.poster_path ?? undefined,
                          rating: item.vote_average,
                          release_date: item.release_date ?? undefined,
                          overview: item.overview,
                        }),
                    }}
                  />
                ))
              : tvResults.map((item) => (
                  <MediaCard
                    key={item.id}
                    card_type="vertical"
                    id={item.id}
                    image={item.backdrop_path ?? undefined}
                    media_type="tv"
                    poster_path={item.poster_path ?? undefined}
                    rating={item.vote_average}
                    release_date={item.first_air_date}
                    title={item.name}
                    overview={item.overview}
                    hideWatchlistButton={true}
                    feedbackActions={{
                      isLiked: isLiked(item.id, "tv"),
                      isDisliked: isDisliked(item.id, "tv"),
                      onMoreLikeThis: () =>
                        handleMoreLikeThis({
                          id: item.id,
                          mediaType: "tv",
                          title: item.name,
                          image: item.poster_path ?? undefined,
                          rating: item.vote_average,
                          release_date: item.first_air_date ?? undefined,
                          overview: item.overview,
                        }),
                      onNotThis: () =>
                        handleNotThis({
                          id: item.id,
                          mediaType: "tv",
                          title: item.name,
                          image: item.poster_path ?? undefined,
                          rating: item.vote_average,
                          release_date: item.first_air_date ?? undefined,
                          overview: item.overview,
                        }),
                    }}
                  />
                ))}
          </div>
        </ScrollContainer>
      </div>
    </div>
  );
};
