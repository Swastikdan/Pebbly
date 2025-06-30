"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollContainer } from "@/components/scroll-container";
import { Play } from "lucide-react";
import Image from "@/components/ui/image";
import {
  Dialog,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVideos } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
export default function MediaVideos({
  id,
  media_type,
}: {
  id: number;
  media_type: "movie" | "tv";
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["media_videos", id, media_type],
    queryFn: async () => getVideos({ id, type: media_type }),
    staleTime: 1000 * 60 * 60 * 24,
  });

  return (
    <ScrollContainer isButtonsVisible={!isLoading}>
      <div className="flex items-center justify-center gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className="bg-accent aspect-video h-44 w-auto rounded-md object-cover md:h-52 lg:h-60"
              />
            ))
          : data?.map((video, index) => (
              <Dialog key={index}>
                <DialogTrigger asChild>
                  <div className="group relative cursor-pointer">
                    <Image
                      src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
                      width={300}
                      height={450}
                      quality={100}
                      alt={video.name}
                      className="bg-accent aspect-video h-44 w-auto rounded-md object-cover md:h-52 lg:h-60"
                    />
                    <span className="absolute top-4 left-4 truncate text-xs text-white md:text-sm">
                      {video.name.slice(0, 30) +
                        (video.name.length > 30 ? "..." : "")}
                    </span>
                    <button className="absolute inset-0 flex cursor-pointer items-center justify-center">
                      <div className="cursor-pointer rounded-full bg-black/60 p-4 transition-transform group-hover:scale-110">
                        <Play
                          className="size-8 scale-100 fill-white text-white transition-transform duration-200 ease-out group-hover:scale-105"
                          style={{
                            filter:
                              "drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06))",
                          }}
                        />
                      </div>
                    </button>
                  </div>
                </DialogTrigger>
                <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
                  <DialogContent className="aspect-video w-full max-w-5xl rounded-md border-0 bg-transparent p-0 ring-0">
                    <DialogHeader className="sr-only">
                      <DialogTitle>{video.name}</DialogTitle>
                    </DialogHeader>
                    <div className="bg-accent relative isolate z-[1] size-full h-full overflow-hidden rounded-md p-0">
                      <iframe
                        src={`https://www.youtube.com/embed/${video.key}`}
                        className="size-full rounded-md"
                        allowFullScreen
                        allow="accelerometer;encrypted-media; gyroscope; picture-in-picture;"
                      ></iframe>
                    </div>
                  </DialogContent>
                </DialogOverlay>
              </Dialog>
            ))}
      </div>
    </ScrollContainer>
  );
}
