import React from "react";
import Image from "next/image";
import WatchListButton from "@/components/WatchListButton";
import { Star } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
export interface MediaCardProps {
  title: string;
  rating: number;
  image?: string;
  poster_path: string;
  id: number;
  media_type: "movie" | "tv" | "person";
  relese_date: string | null;
  known_for_department?: string;
  card_type?: "horizontal" | "vertical";
}
export interface MediaCardSkeletonProps {
  card_type?: "horizontal" | "vertical";
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
        href={`/${media_type}/${id}-${formattedTitle}`}
        className="h-44 w-56 space-y-2 hover:opacity-80 md:h-52 md:w-72"
        aria-label={title}
      >
        <div className="relative h-32 w-full bg-secondary md:h-40">
          <Image
            src={
              image && image !== "" && image !== null
                ? `https://image.tmdb.org/t/p/w500/${image}`
                : `https://via.placeholder.com/300x450?text=Image+Not+Found`
            }
            width={300}
            height={450}
            loading="eager"
            alt={title}
            className="h-32 w-full md:h-40"
          />
          <WatchListButton
            className="absolute right-2 top-2"
            title={title}
            media_type={media_type as "movie" | "tv"}
            id={id}
            image={poster_path}
            rating={rating}
            relese_date={relese_date}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2 text-sm md:text-base">
            <Badge
              variant="secondary"
              className="h-7 uppercase hover:bg-secondary"
            >
              {media_type}
            </Badge>
            <Badge
              variant="secondary"
              className="flex h-7 items-center gap-1 hover:bg-secondary"
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
          <h3 className="font-heading truncate text-sm font-semibold capitalize md:text-base">
            {title}
          </h3>
          <span className="text-xs font-thin md:text-sm">
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
      href={`/${media_type}/${id}-${formattedTitle}`}
      className="h-full w-44 space-y-2 hover:opacity-80 md:w-48"
    >
      <div className="relative h-64 w-full bg-secondary md:h-72">
        <Image
          src={
            image && image !== "" && image !== null
              ? `https://image.tmdb.org/t/p/w500/${image}`
              : `https://via.placeholder.com/300x450?text=Image+Not+Found`
          }
          width={300}
          height={450}
          loading="eager"
          alt={title}
          className="h-64 w-full md:h-72"
        />
        {media_type === "movie" || media_type === "tv" ? (
          <>
            <WatchListButton
              className="absolute right-2 top-2"
              title={title}
              media_type={media_type as "movie" | "tv"}
              id={id}
              image={image ?? poster_path}
              rating={rating}
              relese_date={relese_date}
            />

            <div className="absolute bottom-2 right-2 flex items-center gap-2 text-sm md:text-base">
              <Badge
                variant="secondary"
                className="h-7 uppercase hover:bg-secondary"
              >
                {media_type}
              </Badge>
              <Badge
                variant="secondary"
                className="flex h-7 items-center gap-1 hover:bg-secondary"
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
        <h3 className="font-heading truncate text-sm font-semibold capitalize md:text-base">
          {title}
        </h3>
        <span className="text-xs font-thin md:text-sm">
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
      <div className="h-44 w-56 space-y-2 md:h-52 md:w-72">
        <Skeleton className="relative h-32 w-full md:h-40" />
        <div className="flex h-[40px] flex-col gap-2 md:h-[52px]">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }
  return (
    <div className="h-full w-44 space-y-2 md:w-48">
      <Skeleton className="relative h-64 w-full md:h-72" />
      <div className="flex h-[40px] flex-col gap-2 md:h-[52px]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
