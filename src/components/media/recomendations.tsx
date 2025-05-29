"use client";
import React from "react";
import { ScrollContainer } from "@/components/scroll-container";
import {
  getMovieRecommendations,
  getTvSeriesRecommendations,
} from "@/lib/queries";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { useQuery } from "@tanstack/react-query";
export default function Recomendations({
  media_id,
  media_type,
}: {
  media_id: number;
  media_type: string;
}) {
  const {
    data: movie_data,
    isLoading: movie_is_loading,
    isError: movie_is_error,
  } = useQuery({
    queryKey: ["recomendations", media_id],
    queryFn: async () => await getMovieRecommendations({ id: media_id }),
    staleTime: 1000 * 60 * 60 * 24,
    enabled: media_type === "movie",
  });
  const {
    data: tv_data,
    isLoading: tv_is_loading,
    isError: tv_is_error,
  } = useQuery({
    queryKey: ["recomendations", media_id],
    queryFn: async () => await getTvSeriesRecommendations({ id: media_id }),
    staleTime: 1000 * 60 * 60 * 24,
    enabled: media_type === "tv",
  });

  if (media_type === "movie") {
    return (
      <ScrollContainer isButtonsVisible={!movie_is_loading}>
        <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
          {movie_is_loading || movie_is_error ? (
            Array.from({ length: 6 }).map((_, index) => (
              <MediaCardSkeleton card_type="vertical" key={index} />
            ))
          ) : movie_data?.length === 0 ? (
            <p className="py-2 text-sm" role="alert">
              No recommendations found
            </p>
          ) : (
            movie_data?.map((item) => (
              <MediaCard
                key={item.id}
                title={item.title}
                rating={item.vote_average}
                image={item.backdrop_path}
                poster_path={item.poster_path}
                media_type="movie"
                card_type="vertical"
                id={item.id}
                relese_date={item.release_date}
              />
            ))
          )}
        </div>
      </ScrollContainer>
    );
  }

  return (
    <ScrollContainer isButtonsVisible={!tv_is_loading}>
      <div className="flex gap-4 p-4 first:pl-0 last:pr-0">
        {tv_is_loading || tv_is_error ? (
          Array.from({ length: 6 }).map((_, index) => (
            <MediaCardSkeleton card_type="vertical" key={index} />
          ))
        ) : tv_data?.length === 0 ? (
          <p className="py-2 text-sm" role="alert">
            No recommendations found
          </p>
        ) : (
          tv_data?.map((item) => (
            <MediaCard
              key={item.id}
              title={item.name}
              rating={item.vote_average}
              image={item.backdrop_path}
              poster_path={item.poster_path}
              media_type="tv"
              card_type="vertical"
              id={item.id}
              relese_date={item.first_air_date}
            />
          ))
        )}
      </div>
    </ScrollContainer>
  );
}
