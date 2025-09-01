"use client";

import Link from "next/link";
import { Button } from "@heroui/button";
import { Tabs, Tab } from "@heroui/tabs";

import { ArrowRightLine, Play } from "@/components/icons";
import { ScrollContainer } from "@/components/scroll-container";
import { Image } from "@/components/image";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/dialog";

interface VideoItem {
  key: string;
  name: string;
}

interface ImageItem {
  backdrop_image?: string;
  backdrop_image_raw?: string;
  poster_image?: string;
  poster_image_raw?: string;
}

interface MediaContainerProps {
  id: number;
  urltitle: string;
  youtubeclips: VideoItem[];
  backdrops: ImageItem[];
  posters: ImageItem[];
  title: string;
  is_more_posters_available: boolean;
  is_more_backdrops_available: boolean;
  is_more_clips_available: boolean;
  type: "movie" | "tv";
}

export const MediaContainer = ({
  id,
  urltitle,
  youtubeclips,
  backdrops,
  posters,
  title,
  is_more_posters_available,
  is_more_backdrops_available,
  is_more_clips_available,
  type,
}: MediaContainerProps) => {
  const hasVideos = youtubeclips.length > 0;
  const hasBackdrops = backdrops.length > 0;
  const hasPosters = posters.length > 0;

  const defaultSelectedKey = hasVideos
    ? "videos"
    : hasBackdrops
      ? "backdrops"
      : hasPosters
        ? "posters"
        : "videos";

  const mediaHref = `/${type}/${id}/${urltitle}/media`;

  if (!hasVideos && !hasBackdrops && !hasPosters) {
    return (
      <div className="pb-5">
        <div className="w-fit text-xl font-semibold md:text-2xl">Media</div>
        <p className="py-2 text-sm" role="alert">
          No media available.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-5">
      <div className="flex items-center justify-start gap-5 pb-3 md:gap-10">
        <Link
          className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
          href={mediaHref}
        >
          Media
        </Link>
      </div>
      <Tabs
        aria-label="Media tabs"
        className="pb-2"
        defaultSelectedKey={defaultSelectedKey}
        size="lg"
      >
        {hasVideos && (
          <Tab key="videos" title="Videos">
            <ScrollContainer>
              <div className="flex items-center justify-center gap-3">
                {youtubeclips.map((video) => (
                  <Dialog key={video.key}>
                    <DialogTrigger asChild>
                      <div className="group relative cursor-pointer">
                        <Image
                          alt={video.name}
                          className="bg-default/80 aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
                          height={450}
                          quality={100}
                          src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
                          width={300}
                        />
                        <span className="absolute top-4 left-4 truncate text-xs text-white md:text-sm">
                          {video.name.slice(0, 30) +
                            (video.name.length > 30 ? "..." : "")}
                        </span>
                        <button
                          aria-label={`Play ${video.name}`}
                          className="absolute inset-0 flex items-center justify-center"
                        >
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
                    <DialogOverlay className="bg-white/40 backdrop-blur-lg dark:bg-black/0">
                      <DialogContent className="aspect-video w-full max-w-[95vw] sm:max-w-[85vw]  rounded-2xl border-0 bg-transparent p-0 ring-0">
                        <DialogHeader className="sr-only">
                          <DialogTitle>{video.name}</DialogTitle>
                        </DialogHeader>
                        <div className="bg-default/80 relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] p-0">
                          <iframe
                            allowFullScreen
                            allow="accelerometer;encrypted-media; gyroscope; picture-in-picture;"
                            className="size-full rounded-2xl"
                            src={`https://www.youtube.com/embed/${video.key}`}
                            title={video.name}
                          />
                        </div>
                      </DialogContent>
                    </DialogOverlay>
                  </Dialog>
                ))}
                {is_more_clips_available && (
                  <Button
                    as={Link}
                    className="mr-10 ml-5 flex items-center justify-center"
                    href={mediaHref}
                    size="lg"
                    variant="flat"
                  >
                    View More
                    <ArrowRightLine size={24} />
                  </Button>
                )}
              </div>
            </ScrollContainer>
          </Tab>
        )}

        {hasBackdrops && (
          <Tab key="backdrops" title="Backdrops">
            <ScrollContainer>
              <div className="flex items-center justify-center gap-3">
                {backdrops.map((image, index) => (
                  <Dialog key={index}>
                    <DialogTrigger asChild>
                      <Image
                        alt={title}
                        className="bg-default/80 aspect-video h-44 w-auto cursor-pointer rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
                        height={450}
                        quality={100}
                        src={image.backdrop_image ?? ""}
                        width={300}
                      />
                    </DialogTrigger>
                    <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
                      <DialogContent className="aspect-video w-full max-w-[95vw] sm:max-w-[90vw] rounded-2xl border-0 bg-transparent p-0 ring-0">
                        <DialogHeader className="sr-only">
                          <DialogTitle>{title} Backdrop Image</DialogTitle>
                        </DialogHeader>
                        <div className="bg-default/80 relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] p-0">
                          <Image
                            alt={title}
                            className="aspect-video size-full rounded-2xl object-cover"
                            height={300}
                            src={image.backdrop_image_raw ?? ""}
                            width={450}
                          />
                        </div>
                      </DialogContent>
                    </DialogOverlay>
                  </Dialog>
                ))}
                {is_more_backdrops_available && (
                  <Button
                    as={Link}
                    className="mr-10 ml-5 flex items-center justify-center"
                    href={mediaHref}
                    size="lg"
                    variant="flat"
                  >
                    View More
                    <ArrowRightLine size={24} />
                  </Button>
                )}
              </div>
            </ScrollContainer>
          </Tab>
        )}

        {hasPosters && (
          <Tab key="posters" title="Posters">
            <ScrollContainer>
              <div className="flex items-center justify-center gap-3">
                {posters.map((image, index) => (
                  <Dialog key={index}>
                    <DialogTrigger asChild>
                      <Image
                        alt={title}
                        className="bg-default/80 aspect-[11/16] h-44 w-auto cursor-pointer rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
                        height={300}
                        quality={100}
                        src={image.poster_image ?? ""}
                        width={450}
                      />
                    </DialogTrigger>
                    <DialogOverlay className="bg-white/40 backdrop-blur-lg dark:bg-black/0">
                      <DialogContent className="aspect-[11/16] h-auto max-h-[90vh] w-full max-w-[90vw] rounded-2xl border-0  p-0 ring-0 sm:h-full sm:w-auto">
                        <DialogHeader className="sr-only">
                          <DialogTitle>{title} Poster Image</DialogTitle>
                        </DialogHeader>
                        <div className="bg-default/80 relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] p-0">
                          <Image
                            alt={title}
                            className="aspect-[11/16] h-auto w-full rounded-2xl object-center"
                            height={300}
                            src={image.poster_image_raw ?? ""}
                            width={450}
                          />
                        </div>
                      </DialogContent>
                    </DialogOverlay>
                  </Dialog>
                ))}
                {is_more_posters_available && (
                  <Button
                    as={Link}
                    className="mr-10 ml-5 flex items-center justify-center"
                    href={mediaHref}
                    size="lg"
                    variant="flat"
                  >
                    View More
                    <ArrowRightLine size={24} />
                  </Button>
                )}
              </div>
            </ScrollContainer>
          </Tab>
        )}
      </Tabs>

      {(is_more_posters_available ||
        is_more_backdrops_available ||
        is_more_clips_available) && (
        <Link className="w-fit text-lg hover:opacity-70" href={mediaHref}>
          View All Media
        </Link>
      )}
    </div>
  );
};
