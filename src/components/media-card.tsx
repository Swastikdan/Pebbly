import React from "react";
import Image from "@/components/ui/image";
import WatchListButton from "@/components/watch-list-button";
import { Star } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_PREFIX } from "@/constants";
export interface MediaCardProps {
  title: string;
  rating: number;
  image?: string;
  poster_path: string;
  id: number;
  media_type: "movie" | "tv" | "person";
  relese_date: string | null;
  known_for_department?: string;
  card_type?: "horizontal" | "vertical" | "small_card_person";
}
export interface PersonCardProps {
  name: string;
  profile_path: string;
  id: number;
  known_for_department: string;
}
export interface MediaCardSkeletonProps {
  card_type?: "horizontal" | "vertical" | "small_card_person";
}

export function MediaCard({
  title,
  rating,
  image,
  poster_path,
  id,
  media_type,
  relese_date,
  known_for_department,
  card_type = "horizontal",
}: MediaCardProps) {
  const formattedTitle = title.replace(/ /g, "-").toLowerCase();
  const formattedReleseDate = relese_date
    ? new Date(relese_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  if (card_type === "vertical") {
    return (
      <Link
        href={`/${media_type}/${id}/${formattedTitle}`}
        className="h-52 w-72 space-y-2  transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70"
        aria-label={title}
      >
        <div className="bg-secondary/80 relative h-40 w-full rounded-md">
          <Image
            src={`${IMAGE_PREFIX.SD_BACKDROP}${image}`}
            width={300}
            height={450}
            loading="eager"
            alt={title}
            className="h-40 w-full rounded-md"
          />
          <WatchListButton
            className="absolute top-2 right-2"
            title={title}
            media_type={media_type as "movie" | "tv"}
            id={id}
            image={poster_path}
            rating={rating}
            relese_date={relese_date}
            aria-label={`Add ${title} to watchlist`}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-2 text-sm md:text-base">
            <Badge variant="default" className="h-7 rounded-sm px-2 uppercase">
              {media_type}
            </Badge>
            <Badge
              variant="default"
              className="flex h-7 items-center gap-1 rounded-sm px-2"
            >
              {rating > 0.0 ? (
                <>
                  <Star size="16" className="fill-current text-yellow-400" />
                  {rating.toFixed(1)}
                </>
              ) : (
                `NR`
              )}
            </Badge>
          </div>
        </div>
        <div className="flex h-[40px] flex-col gap-2 md:h-[52px]">
          <h3 className="truncate text-sm font-semibold capitalize">{title}</h3>
          <span className="text-xs ">
            {media_type === "person"
              ? known_for_department
              : formattedReleseDate}
          </span>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={`/${media_type}/${id}/${formattedTitle}`}
      className="h-full w-44 space-y-2  transition-opacity duration-200 ease-in-out hover:opacity-90 md:w-48 dark:hover:opacity-70 "
      aria-label={title}
    >
      <div className=" relative h-64 w-full rounded-md md:h-72">
        <Image
          src={`${IMAGE_PREFIX.SD_POSTER}${image}`}
          width={300}
          height={450}
          alt={title}
          className="h-64 w-full  md:h-72 rounded-md"
        />
        {media_type === "movie" || media_type === "tv" ? (
          <>
            <WatchListButton
              className="absolute top-2 right-2"
              title={title}
              media_type={media_type}
              id={id}
              image={image ?? poster_path}
              rating={rating}
              relese_date={relese_date}
              aria-label={`Add ${title} to watchlist`}
            />

            <div className="absolute right-2 bottom-2 flex items-center gap-2 text-sm md:text-base">
              <Badge
                variant="default"
                className="h-7 rounded-sm px-2 uppercase"
              >
                {media_type}
              </Badge>
              <Badge
                variant="default"
                className="flex h-7 items-center gap-1 rounded-sm px-2"
              >
                {rating > 0.0 ? (
                  <>
                    <Star size="16" className="fill-current text-yellow-400" />
                    {rating.toFixed(1)}
                  </>
                ) : (
                  `NR`
                )}
              </Badge>
            </div>
          </>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="truncate text-sm font-semibold capitalize">{title}</h3>
        <span className="text-xs">
          {media_type === "person" ? known_for_department : formattedReleseDate}
        </span>
      </div>
    </Link>
  );
}

export function MediaCardSkeleton({
  card_type = "horizontal",
}: MediaCardSkeletonProps) {
  if (card_type === "vertical") {
    return (
      <div className="h-52 w-72 space-y-2" role="status" aria-label="Loading">
        <Skeleton className="h-40 w-full  md:h-40" />
        <div className="flex h-[40px] flex-col gap-2 md:h-[52px]">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  } else if (card_type === "small_card_person") {
    return (
      <div
        className="h-32 w-28 space-y-2 md:h-40 md:w-32"
        role="status"
        aria-label="Loading"
      >
        <Skeleton className="relative h-24 w-full md:h-32" />
        <div className="flex h-[40px] flex-col gap-2 md:h-[52px]">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }
  return (
    <div
      className="h-full w-44 space-y-2 md:w-48"
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="relative h-64 w-full md:h-72" />
      <div className="flex h-[40px] flex-col gap-2 md:h-[52px]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function PersonCard({
  name,
  profile_path,
  known_for_department,
}: PersonCardProps) {
  return (
    <div
      className=" h-[13.25rem] w-32 space-y-2  p-2 md:h-[15.5rem] md:w-36"
      aria-label={name}
    >
      <Image
        src={`${IMAGE_PREFIX.SD_PROFILE}${profile_path}`}
        width={300}
        height={450}
        alt={name}
        className="bg-secondary h-36 w-full rounded-md  md:h-44"
      />
      <div className="flex flex-col gap-1 py-1">
        <h3 className="truncate text-sm font-semibold capitalize">{name}</h3>
        <span className="truncate text-[10px] font-thin md:text-xs">
          {known_for_department}
        </span>
      </div>
    </div>
  );
}
