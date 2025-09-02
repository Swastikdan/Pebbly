"use client";

import { Tabs, Tab } from "@heroui/tabs";
import { useQueries } from "@tanstack/react-query";
import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { getMedia } from "@/lib/quries";

import { ScrollContainer } from "./scroll-container";

// Types
interface MediaItem {
  id: number;
  poster_path?: string;
  backdrop_path?: string;
  media_type?: "movie" | "tv";
  vote_average: number;
  first_air_date?: string;
  release_date?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
}

// Media list renderer
function MediaList({
  data,
  ariaLabel,
  cardType = "default",
  mediaType,
}: {
  data: MediaItem[] | undefined;
  ariaLabel: string;
  cardType?: "default" | "vertical";
  mediaType?: "movie" | "tv";
}) {
  if (!data) return null;

  return (
    <ScrollContainer aria-label={ariaLabel} isButtonsVisible={true}>
      <div className="flex gap-2 p-4 first:pl-0 last:pr-0" role="list">
        {data.map((item) => (
          <MediaCard
            key={item.id}
            id={item.id}
            image={
              cardType === "vertical"
                ? (item.backdrop_path ?? "")
                : (item.poster_path ?? "")
            }
            media_type={
              mediaType || (item.media_type as "movie" | "tv") || "movie"
            }
            poster_path={item.poster_path ?? ""}
            rating={item.vote_average}
            release_date={item.first_air_date ?? item.release_date ?? null}
            title={
              item.title ??
              item.name ??
              item.original_title ??
              item.original_name ??
              "Untitled"
            }
            {...(cardType === "vertical" && { card_type: "vertical" })}
          />
        ))}
      </div>
    </ScrollContainer>
  );
}

// Loading skeletons
const SectionSkeleton = memo(function SectionSkeleton({
  title,
  cardType = "default",
  count = 6,
}: {
  title: string;
  cardType?: "default" | "vertical";
  count?: number;
}) {
  return (
    <div>
      <h2 className="px-1 pb-2 text-xl font-medium md:text-2xl">{title}</h2>
      <div
        className={cn(
          "flex gap-2 px-2 first:pl-0 last:pr-0",
          title === "Upcoming Movies" ? "p-4" : "py-10 pt-18"
        )}
      >
        {Array.from({ length: count }).map((_, index) => (
          <MediaCardSkeleton
            key={`${title.toLowerCase().replace(/\s+/g, "-")}-${index}`}
            {...(cardType === "vertical" && { card_type: "vertical" })}
          />
        ))}
      </div>
    </div>
  );
});

export const GlobalHomepageMediaListLoadingState = memo(
  function GlobalHomepageMediaListLoadingState() {
    return (
      <div className="mx-auto flex w-full max-w-screen-xl overflow-hidden px-5 py-5 pt-5 pb-5 md:pt-10">
        <div className="flex w-full flex-col space-y-8">
          <SectionSkeleton title="Trending" />

          <SectionSkeleton title="What's Popular" />
          <SectionSkeleton title="Top Rated" />
        </div>
      </div>
    );
  }
);

// Main component
export function HomepageMediaListSection() {
  const queryConfigs = useMemo(
    () => [
      {
        queryKey: ["trending_day"],
        queryFn: () => getMedia({ type: "trending_day" }),
      },
      {
        queryKey: ["trending_week"],
        queryFn: () => getMedia({ type: "trending_week" }),
      },
      {
        queryKey: ["movies_popular"],
        queryFn: () => getMedia({ type: "movies_popular" }),
      },
      {
        queryKey: ["tv-shows_popular"],
        queryFn: () => getMedia({ type: "tv-shows_popular" }),
      },
      {
        queryKey: ["movies_top-rated"],
        queryFn: () => getMedia({ type: "movies_top-rated" }),
      },
      {
        queryKey: ["tv-shows_top-rated"],
        queryFn: () => getMedia({ type: "tv-shows_top-rated" }),
      },
    ],
    []
  );

  const queries = useQueries({ queries: queryConfigs });

  const [
    trendingDayQuery,
    trendingWeekQuery,
    popularMoviesQuery,
    popularTvQuery,
    topRatedMoviesQuery,
    topRatedTvQuery,
  ] = queries;

  const isGlobalLoading = queries.some((q) => q.isFetching);

  if (isGlobalLoading) {
    return <GlobalHomepageMediaListLoadingState />;
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-xl px-5 py-5 pt-5 pb-5 md:pt-10">
      <div className="flex w-full flex-col space-y-8">
        {/* Trending */}
        <section>
          <h2 className="px-1 pb-2 text-xl font-medium md:text-2xl">
            Trending
          </h2>
          <Tabs key="trending_section" aria-label="Trending">
            <Tab key="trending_day" title="Today">
              <MediaList
                ariaLabel="Trending Movies of the Day"
                data={trendingDayQuery.data as MediaItem[]}
              />
            </Tab>
            <Tab key="trending_week" title="This Week">
              <MediaList
                ariaLabel="Trending Movies of the Week"
                data={trendingWeekQuery.data as MediaItem[]}
              />
            </Tab>
          </Tabs>
        </section>

        {/* Popular */}
        <section>
          <h2 className="px-1 pb-2 text-xl font-medium md:text-2xl">{`What's Popular`}</h2>
          <Tabs key="popular_section" aria-label="Popular">
            <Tab key="popular_movie" title="In Theaters">
              <MediaList
                ariaLabel="Popular Movies"
                data={popularMoviesQuery.data as MediaItem[]}
                mediaType="movie"
              />
            </Tab>
            <Tab key="popular_tv" title="On TV">
              <MediaList
                ariaLabel="Popular TV Shows"
                data={popularTvQuery.data as MediaItem[]}
                mediaType="tv"
              />
            </Tab>
          </Tabs>
        </section>

        {/* Top Rated */}
        <section>
          <h2 className="px-1 pb-2 text-xl font-medium md:text-2xl">
            Top Rated
          </h2>
          <Tabs key="top_rated_section" aria-label="Top Rated">
            <Tab key="top_rated_movies" title="Movies">
              <MediaList
                ariaLabel="Top Rated Movies"
                data={topRatedMoviesQuery.data as MediaItem[]}
                mediaType="movie"
              />
            </Tab>
            <Tab key="top_rated_tv" title="TV Shows">
              <MediaList
                ariaLabel="Top Rated TV Shows"
                data={topRatedTvQuery.data as MediaItem[]}
                mediaType="tv"
              />
            </Tab>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
