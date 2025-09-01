import type { SeasonInfo } from "@/types";

import React from "react";
import Link from "next/link";
import { Chip } from "@heroui/chip";

import { Image } from "@/components/image";
import { IMAGE_PREFIX } from "@/config/image";
import { Star } from "@/components/icons";

export const CurrentSeason = ({
  id,
  urltitle,
  season_data,
}: {
  id: number;
  urltitle: string;
  season_data: SeasonInfo;
}) => {
  return (
    <div className="pb-5">
      <div className="flex flex-col justify-start gap-3">
        <span className="w-fit text-xl font-semibold md:text-2xl">
          Current Season
        </span>
        <div
          aria-label={`Current Season: ${season_data.name}`}
          className="flex items-start gap-5 rounded-3xl p-3 md:p-5 border-2 border-default bg-default-50"
          role="region"
        >
          <div className="min-w-[7rem] md:min-w-[9rem]">
            <div
              aria-label={`View season ${season_data.season_number} details`}
              className="transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70"
            >
              <Image
                alt={season_data.name}
                className="h-40 w-28 shrink-0 rounded-xl object-cover md:h-52 md:w-36"
                height={300}
                src={IMAGE_PREFIX.HD_POSTER + season_data.poster_path}
                width={200}
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col items-start justify-center gap-2 overflow-hidden py-3">
            <div
              aria-label={`View season ${season_data.season_number} details`}
              className="line-clamp-1 text-xl font-bold transition-opacity duration-200 ease-in-out hover:opacity-90 md:text-2xl dark:hover:opacity-70"
            >
              {season_data.name}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {season_data.vote_average > 0 && (
                <Chip
                  aria-label={`Rating: ${season_data.vote_average * 10}%`}
                  className="rounded-xl px-1 w-full text-sm font-light"
                  variant="faded"
                >
                  <span className="flex flex-row items-center gap-1 ">
                    <Star className="size-3 fill-current" size={16} />
                    {season_data.vote_average * 10} %
                  </span>
                </Chip>
              )}
              <span className="text-sm">
                {season_data.air_date?.split("-")[0] ?? "TBA"}
              </span>
              {` • `}
              <span className="text-sm">
                {season_data.episode_count} Episodes
              </span>
            </div>
            <span className="line-clamp-3 text-sm md:text-base">
              {season_data.overview || "No overview available"}
            </span>
          </div>
        </div>
        <Link
          aria-label={`View all episodes of season`}
          className="w-fit text-lg hover:opacity-70"
          href={`/tv/${id}/${urltitle}/seasons`}
        >
          View All Season
        </Link>
      </div>
    </div>
  );
};
