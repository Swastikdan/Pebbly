"use client";
import React, { cache } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";

import { Star } from "@/components/icons";
import { MediaCard } from "@/components/media-card";
import { getCollection } from "@/lib/quries";
import { Image } from "@/components/image";
import { IMAGE_PREFIX } from "@/config/image";
import { Collection } from "@/types";
import { ensureCanonicalSlugAndRedirect } from "@/lib/slug-redirect";

export const MovieCollectionsPage = ({
  params,
}: {
  params: { id: string; slug: string };
}) => {
  const { id: collection_id, slug: collection_slug } = params;
  const {
    data: collection_data,
    error,
    isLoading,
  } = useQuery<Collection>({
    queryKey: ["movie_details", collection_id],
    queryFn: cache(
      async () => await getCollection({ id: Number(collection_id) })
    ),
  });

  if (isLoading) {
    return (
      <div className="grid h-full min-h-screen place-content-center items-center justify-center">
        <Spinner color="current" />
      </div>
    );
  }

  if (!collection_data || error) {
    notFound();
  }
  const { id, name, overview, poster_path, parts } = collection_data;

  ensureCanonicalSlugAndRedirect({
    entity: "collection",
    id: id,
    title: name,
    incomingPathname: `/collection/${collection_id}/${collection_slug}`,
  });

  const user_rating =
    parts && parts.length > 0
      ? parseInt(
          (
            (parts.map((part) => part.vote_average).reduce((a, b) => a + b, 0) /
              parts.length) *
            10
          ).toFixed(0)
        )
      : 0;

  const original_language =
    Array.isArray(parts) && parts.length > 0
      ? parts[0].original_language
      : "en";

  const part_count = parts ? parts.length : 0;

  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4 py-5">
      <div className="flex w-full flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="flex w-full justify-center sm:w-auto">
          <Image
            alt={name}
            className="h-[280px] w-[200px] shrink-0 rounded-xl object-cover sm:h-52 sm:w-36"
            height={300}
            src={IMAGE_PREFIX.HD_POSTER + poster_path}
            width={200}
          />
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-2 overflow-hidden py-3 sm:items-start">
          <span className="line-clamp-1 text-center text-xl font-bold transition-opacity duration-200 ease-in-out hover:opacity-90 sm:text-left md:text-2xl dark:hover:opacity-70">
            {name}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {user_rating > 0 && (
              <Chip
                className=" rounded-md px-1 text-sm font-light"
                variant="faded"
              >
                <span className="flex flex-row w-full items-center gap-1">
                  <Star className="size-3 fill-current" size={16} />
                  {user_rating} %
                </span>
              </Chip>
            )}
            <span className="text-sm uppercase">{original_language}</span>
            {` • `}
            <span className="text-sm">{part_count} Movies</span>
          </div>
          <span className="line-clamp-3 text-center text-sm sm:text-left md:text-base">
            {overview || "No overview available"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-5 py-10">
        <span className="text-foreground text-2xl font-semibold">
          All Movies
        </span>
        <div className="grid w-full grid-cols-2 items-center justify-center gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {parts?.map((part) => (
            <MediaCard
              key={part.id}
              id={part.id}
              image={part.poster_path ?? ""}
              media_type="movie"
              poster_path={part.poster_path ?? ""}
              rating={part.vote_average ?? 0}
              release_date={part.release_date ?? null}
              title={part.title}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
