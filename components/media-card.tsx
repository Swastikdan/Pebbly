import { Card } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";
import { Chip } from "@heroui/chip";
import { Link } from "@heroui/link";
import { memo } from "react";

import { IMAGE_PREFIX } from "@/config/image";
import { formatMediaTitle } from "@/lib/utils";

import { Image } from "./image";
import { Star } from "./icons";
import { WatchlistButton } from "./watchlist-button";

export interface MediaCardProps {
  title: string;
  rating: number;
  image?: string;
  poster_path: string;
  id: number;
  media_type: "movie" | "tv";
  release_date: string | null;
  known_for_department?: string;
  card_type?: "horizontal" | "vertical";
  is_on_watchlist_page?: boolean;
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
  id,
  poster_path,
  media_type,
  release_date,
  is_on_watchlist_page,
  card_type = "horizontal",
}: MediaCardProps) {
  const formattedTitle = formatMediaTitle.encode(title);
  const formattedReleaseDate = release_date
    ? new Date(release_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const imageUrl =
    card_type === "vertical"
      ? `${IMAGE_PREFIX.SD_BACKDROP}${image}`
      : `${IMAGE_PREFIX.SD_POSTER}${image}`;

  if (card_type === "vertical") {
    return (
      <div className="group relative h-56 w-74 space-y-2">
        <WatchlistButton
          className="absolute top-4 right-4 z-20"
          id={id}
          image={poster_path}
          is_on_watchlist_page={is_on_watchlist_page}
          media_type={media_type}
          rating={rating}
          release_date={release_date ?? ""}
          title={title}
        />

        <Link
          className="block h-full w-full"
          href={`/${media_type}/${id}/${formattedTitle}`}
        >
          <Card
            isHoverable
            className="relative h-full w-full space-y-2 bg-transparent p-2"
            shadow="none"
          >
            <div className="relative">
              <Image
                alt={title}
                className="bg-default/50 h-40 w-74 rounded-xl"
                height={300}
                src={imageUrl}
                width={450}
              />
              <div className="absolute right-2 bottom-2 z-20 flex items-center gap-2 text-sm md:text-base">
                <Chip
                  className="px-2 uppercase"
                  radius="sm"
                  size="md"
                  variant="faded"
                >
                  {media_type}
                </Chip>
                <Chip
                  radius="sm"
                  size="md"
                  startContent={
                    rating > 0.0 && (
                      <Star className="size-4 fill-current text-yellow-400" />
                    )
                  }
                  variant="faded"
                >
                  {rating > 0.0 ? rating.toFixed(1) : "NR"}
                </Chip>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2">
              <h3 className="truncate text-start text-sm font-semibold capitalize">
                {title}
              </h3>
              <span className="text-start text-xs">{formattedReleaseDate}</span>
            </div>
          </Card>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-full w-48 md:w-52">
      <WatchlistButton
        className="absolute top-4 right-4 z-20"
        id={id}
        image={poster_path}
        is_on_watchlist_page={is_on_watchlist_page}
        media_type={media_type}
        rating={rating}
        release_date={release_date ?? ""}
        title={title}
      />

      <Link
        className="block h-full w-full"
        href={`/${media_type}/${id}/${formattedTitle}`}
      >
        <Card
          isHoverable
          className="relative h-full w-full space-y-2 bg-transparent p-2"
          shadow="none"
        >
          <div className="relative">
            <Image
              alt={title}
              className="bg-default/50 h-64 w-46 rounded-xl md:h-72 md:w-50"
              height={450}
              src={imageUrl}
              width={300}
            />
            <div className="absolute right-2 bottom-2 z-20 flex items-center gap-2 text-sm md:text-base">
              <Chip
                className="px-2 uppercase"
                radius="sm"
                size="md"
                variant="faded"
              >
                {media_type}
              </Chip>
              <Chip
                radius="sm"
                size="md"
                startContent={
                  rating > 0.0 && (
                    <Star className="size-4 fill-current text-yellow-400" />
                  )
                }
                variant="faded"
              >
                {rating > 0.0 ? rating.toFixed(1) : "NR"}
              </Chip>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2">
            <h3 className="truncate text-start text-sm font-semibold capitalize">
              {title}
            </h3>
            <span className="text-start text-xs">{formattedReleaseDate}</span>
          </div>
        </Card>
      </Link>
    </div>
  );
}

export const PersonCard = memo(function PersonCard({
  name,
  profile_path,
  known_for_department,
}: PersonCardProps) {
  const imageUrl = `${IMAGE_PREFIX.SD_PROFILE}${profile_path}`;

  return (
    <Card
      className="relative h-[13.25rem] md:h-[15.5rem] w-30 md:w-36 space-y-2  p-2"
      shadow="none"
    >
      <Image
        alt={name}
        className="h-36 w-full rounded-xl md:h-44 bg-default/50 "
        height={225}
        src={imageUrl}
        width={150}
      />

      <div className="flex w-full flex-col gap-1">
        <h3 className="truncate text-sm font-semibold">{name}</h3>

        <span className="text-xs truncate">{known_for_department}</span>
      </div>
    </Card>
  );
});

export const MediaCardSkeleton = memo(function MediaCardSkeleton({
  card_type,
}: MediaCardSkeletonProps) {
  if (card_type === "vertical") {
    return (
      <div className="h-56 w-72 space-y-2">
        <div className="relative h-full w-full space-y-2 rounded-xl bg-transparent p-2">
          <Skeleton className="h-40 w-72 rounded-xl" />
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-3 w-32 rounded-xl" />
            <Skeleton className="h-2 w-24 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-46 md:w-50">
      <div className="relative h-full w-full space-y-2 rounded-xl bg-transparent p-2">
        <Skeleton className="h-64 w-44 rounded-xl md:h-72 md:w-48" />
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-3 w-32 rounded-xl" />
          <Skeleton className="h-2 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
});
