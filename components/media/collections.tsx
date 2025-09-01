"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";
import Link from "next/link";

import { getCollection } from "@/lib/quries";
import { formatMediaTitle } from "@/lib/utils";

export const Collections = ({ id }: { id: number }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["collection", id],
    queryFn: async () => await getCollection({ id }),
  });

  return (
    <>
      {isLoading ? (
        <Skeleton
          aria-label="Loading collection"
          className="h-48 w-full rounded-2xl md:h-52 lg:h-60"
        />
      ) : (
        <div
          aria-label={`Collection: ${data?.name}`}
          className="bg-secondary relative h-48 w-full overflow-hidden rounded-2xl md:h-52 lg:h-60"
          role="region"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.9036624649859944) 0%, rgba(0,0,0,0.7120098039215687) 55%, rgba(13,13,13,0.2111694677871149) 100%), url(https://image.tmdb.org/t/p/w1440_and_h320_multi_faces/${data?.backdrop_path})`,
            }}
          />

          <div className="relative flex h-full flex-col items-start justify-center p-5">
            <span className="text-background dark:text-foreground text-lg font-bold md:text-xl lg:text-2xl xl:text-3xl">
              Part of the {data?.name}
            </span>
            <span className="text-background dark:text-foreground mt-2 flex flex-wrap text-xs font-light md:text-sm lg:text-base">
              Includes{" "}
              {data?.parts?.map((part) => part.title)?.join(", ") ?? ""}
            </span>

            <Button
              as={Link}
              className="mt-3 rounded-full font-medium shadow"
              href={`/collection/${id}/${formatMediaTitle.encode(data?.name ?? "")}`}
              size="lg"
              variant="solid"
            >
              View Collection
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
