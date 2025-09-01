"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";

import { Image } from "@/components/image";
import { getTvDetails } from "@/lib/quries";
import { Star } from "@/components/icons";
import { IMAGE_PREFIX } from "@/config/image";

interface SeasonContainerProps {
  tv_id_param: number;
  id: string;
  urltitle: string;
}

interface Season {
  id: number;
  name: string;
  season_number: number;
  poster_path: string;
  vote_average: number;
  air_date: string | null;
  episode_count: number;
  overview: string;
}

export const SeasonContainer = ({
  tv_id_param,
  //id,
  //urltitle,
}: SeasonContainerProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tv_details", tv_id_param],
    queryFn: async () => await getTvDetails({ id: tv_id_param }),
    staleTime: 1000 * 60 * 60 * 24,
  });

  if (isLoading) {
    return (
      <div className="grid h-full min-h-screen place-content-center items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data || error) {
    return notFound();
  }

  // if season. season_number = 0 push it back to end
  const seasons = data?.seasons?.slice() ?? [];
  const zeroSeason = seasons.find((season) => season.season_number === 0);

  if (zeroSeason) {
    seasons.splice(seasons.indexOf(zeroSeason), 1);
    seasons.push(zeroSeason);
  }

  return (
    <div className="flex flex-col gap-5 py-5 pb-32">
      {seasons.map((season: Season) => (
        <div
          key={season.id}
          aria-label={`Current Season: ${season.name}`}
          className="border-2 border-default bg-default-50 flex items-start gap-5 rounded-3xl p-3 md:p-5"
          role="region"
        >
          <div className="min-w-[7rem] md:min-w-[9rem]">
            <div
              aria-label={`View season ${season.season_number} details`}
              className="transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70"
            >
              <Image
                alt={season.name}
                className="h-40 w-28 shrink-0 rounded-xl object-cover md:h-52 md:w-36"
                height={300}
                src={IMAGE_PREFIX.HD_POSTER + season.poster_path}
                width={200}
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col items-start justify-center gap-2 overflow-hidden py-3">
            <div
              aria-label={`View season ${season.season_number} details`}
              className="line-clamp-1 text-xl font-bold transition-opacity duration-200 ease-in-out hover:opacity-90 md:text-2xl dark:hover:opacity-70"
            >
              {season.name}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {season.vote_average > 0 && (
                <Chip
                  aria-label={`Rating: ${season.vote_average * 10}%`}
                  className="rounded-xl px-1 w-full text-sm font-light"
                  variant="faded"
                >
                  <span className="flex flex-row items-center gap-1 ">
                    <Star className="size-3 fill-current" size={16} />
                    {season.vote_average * 10} %
                  </span>
                </Chip>
              )}
              <span className="text-sm">
                {season.air_date?.split("-")[0] ?? "TBA"}
              </span>
              {` • `}
              <span className="text-sm">{season.episode_count} Episodes</span>
            </div>
            <span className="line-clamp-3 text-sm md:text-base">
              {season.overview || "No overview available"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
