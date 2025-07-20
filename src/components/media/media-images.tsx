"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollContainer } from "@/components/scroll-container";
import Image from "@/components/ui/image";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/ui/dialog";
import { getImages } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_PREFIX } from "@/constants";

export default function MediaImages({
  id,
  media_type,
}: {
  id: number;
  media_type: "movie" | "tv";
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["media_images", id, media_type],
    queryFn: async () => getImages({ id, type: media_type }),
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="flex flex-col gap-3">
      <span className="w-fit text-lg md:text-xl">Backdrops</span>
      <ScrollContainer isButtonsVisible={!isLoading}>
        <div className="flex items-center justify-center gap-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="bg-accent aspect-video h-44 w-auto rounded-md md:h-52 lg:h-60"
                />
              ))
            : data?.backdrops?.map((image, index) => (
                <Dialog key={index}>
                  <DialogTrigger asChild>
                    <Image
                      key={index}
                      src={IMAGE_PREFIX.SD_BACKDROP + image.file_path}
                      alt={image.file_path}
                      width={300}
                      height={450}
                      quality={100}
                      className="bg-accent aspect-video h-44 w-auto cursor-pointer rounded-md object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
                    />
                  </DialogTrigger>
                  <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
                    <DialogContent className="aspect-video w-full max-w-5xl rounded-md border-0 bg-transparent p-0 ring-0">
                      <DialogHeader className="sr-only">
                        <DialogTitle>
                          {image.file_path} Backdrop Image
                        </DialogTitle>
                      </DialogHeader>
                      <div className="bg-accent relative isolate z-[1] size-full h-full overflow-hidden rounded-md p-0">
                        <Image
                          src={IMAGE_PREFIX.ORIGINAL + image.file_path}
                          alt={image.file_path}
                          width={450}
                          height={300}
                          className="aspect-video size-full rounded-md object-cover"
                        />
                      </div>
                    </DialogContent>
                  </DialogOverlay>
                </Dialog>
              ))}
        </div>
      </ScrollContainer>
      <span className="w-fit text-lg md:text-xl">Posters</span>
      <ScrollContainer isButtonsVisible={!isLoading}>
        <div className="flex items-center justify-center gap-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="bg-accent aspect-video h-44 w-auto rounded-md md:h-52 lg:h-60"
                />
              ))
            : data?.posters?.map((image, index) => (
                <Dialog key={index}>
                  <DialogTrigger asChild>
                    <Image
                      key={index}
                      src={IMAGE_PREFIX.SD_POSTER + image.file_path}
                      alt={image.file_path}
                      width={450}
                      height={300}
                      quality={100}
                      className="bg-accent aspect-[11/16] h-44 w-min cursor-pointer rounded-md object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
                    />
                  </DialogTrigger>
                  <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
                    <DialogContent className="aspect-[11/16] h-auto max-h-[90vh] w-full max-w-[90vw] rounded-md border-0 bg-transparent p-0 ring-0 sm:h-full sm:w-auto">
                      <DialogHeader className="sr-only">
                        <DialogTitle>
                          {image.file_path} Poster Image
                        </DialogTitle>
                      </DialogHeader>
                      <div className="bg-accent relative isolate z-[1] size-full h-full overflow-hidden rounded-md p-0">
                        <Image
                          src={IMAGE_PREFIX.ORIGINAL + image.file_path}
                          alt={image.file_path}
                          width={450}
                          height={300}
                          className="aspect-[11/16] h-auto w-full rounded-md object-center"
                        />
                      </div>
                    </DialogContent>
                  </DialogOverlay>
                </Dialog>
              ))}
        </div>
      </ScrollContainer>
    </div>
  );
}
