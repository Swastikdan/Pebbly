import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollContainer } from "@/components/scroll-container";
import Image from "@/components/ui/image";

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

export default function MediaContainer({
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
}: MediaContainerProps) {
  return (
    <div className="pb-5">
      {youtubeclips.length === 0 &&
      backdrops.length === 0 &&
      posters.length === 0 ? (
        <>
          <div className="w-fit text-xl font-semibold md:text-2xl">Media</div>
          <p className="py-2 text-sm" role="alert">
            No media available.
          </p>
        </>
      ) : (
        <Tabs
          defaultValue={
            youtubeclips.length > 0
              ? "videos"
              : backdrops.length > 0
                ? "backdrops"
                : posters.length > 0
                  ? "posters"
                  : "videos"
          }
          className="pb-2"
        >
          <div className="flex items-center justify-start gap-5 pb-3 md:gap-10">
            <Link
              href={`/${type}/${id}/${urltitle}/media`}
              className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
            >
              Media
            </Link>

            <TabsList className="bg-transparent">
              {youtubeclips.length > 0 && (
                <TabsTrigger
                  value="videos"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  Videos
                </TabsTrigger>
              )}
              {backdrops.length > 0 && (
                <TabsTrigger
                  value="backdrops"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  Backdrops
                </TabsTrigger>
              )}
              {posters.length > 0 && (
                <TabsTrigger
                  value="posters"
                  className="data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary h-8 px-5 data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:shadow-none"
                >
                  Posters
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          {youtubeclips.length > 0 && (
            <TabsContent value="videos">
              <ScrollContainer>
                <div className="flex items-center justify-center gap-3">
                  {youtubeclips.map((video, index) => (
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
                          <button className="absolute inset-0 flex items-center justify-center">
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
                  {is_more_clips_available && (
                    <Link href={`/${type}/${id}/${urltitle}/media`}>
                      <Button
                        variant="secondary"
                        size="lg"
                        className="mr-10 ml-5 flex items-center justify-center"
                      >
                        View More
                        <ArrowRight size={24} />
                      </Button>
                    </Link>
                  )}
                </div>
              </ScrollContainer>
            </TabsContent>
          )}

          {backdrops.length > 0 && (
            <TabsContent value="backdrops">
              <ScrollContainer>
                <div className="flex items-center justify-center gap-3">
                  {backdrops.map((image, index) => (
                    <Dialog key={index}>
                      <DialogTrigger asChild>
                        <Image
                          key={index}
                          src={image.backdrop_image ?? ""}
                          alt={title}
                          width={300}
                          height={450}
                          quality={100}
                          className="bg-accent aspect-video h-44 w-auto cursor-pointer rounded-md object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
                        />
                      </DialogTrigger>
                      <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
                        <DialogContent className="aspect-video w-full max-w-5xl rounded-md border-0 bg-transparent p-0 ring-0">
                          <DialogHeader className="sr-only">
                            <DialogTitle>{title} Backdrop Image</DialogTitle>
                          </DialogHeader>
                          <div className="bg-accent relative isolate z-[1] size-full h-full overflow-hidden rounded-md p-0">
                            <Image
                              src={image.backdrop_image_raw ?? ""}
                              alt={title}
                              width={450}
                              height={300}
                              className="aspect-video size-full rounded-md object-cover"
                            />
                          </div>
                        </DialogContent>
                      </DialogOverlay>
                    </Dialog>
                  ))}
                  {is_more_backdrops_available && (
                    <Link href={`/${type}/${id}/${urltitle}/media`}>
                      <Button
                        variant="secondary"
                        size="lg"
                        className="mr-10 ml-5 flex items-center justify-center"
                      >
                        View More
                        <ArrowRight size={24} />
                      </Button>
                    </Link>
                  )}
                </div>
              </ScrollContainer>
            </TabsContent>
          )}
          {posters.length > 0 && (
            <TabsContent value="posters">
              <ScrollContainer>
                <div className="flex items-center justify-center gap-3">
                  {posters.map((image, index) => (
                    <Dialog key={index}>
                      <DialogTrigger asChild>
                        <Image
                          key={index}
                          src={image.poster_image ?? ""}
                          alt={title}
                          width={450}
                          height={300}
                          quality={100}
                          className="bg-accent aspect-[11/16] h-44 w-auto cursor-pointer rounded-md object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
                        />
                      </DialogTrigger>
                      <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
                        <DialogContent className="aspect-[11/16] h-auto max-h-[90vh] w-full max-w-[90vw] rounded-md border-0 bg-transparent p-0 ring-0 sm:h-full sm:w-auto">
                          <DialogHeader className="sr-only">
                            <DialogTitle>{title} Poster Image</DialogTitle>
                          </DialogHeader>
                          <div className="bg-accent relative isolate z-[1] size-full h-full overflow-hidden rounded-md p-0">
                            <Image
                              src={image.poster_image_raw ?? ""}
                              width={450}
                              height={300}
                              alt={title}
                              className="aspect-[11/16] h-auto w-full rounded-md object-center"
                            />
                          </div>
                        </DialogContent>
                      </DialogOverlay>
                    </Dialog>
                  ))}
                  {is_more_posters_available && (
                    <Link href={`/${type}/${id}/${urltitle}/media`}>
                      <Button
                        variant="secondary"
                        size="lg"
                        className="mr-10 ml-5 flex items-center justify-center"
                      >
                        View More
                        <ArrowRight size={24} />
                      </Button>
                    </Link>
                  )}
                </div>
              </ScrollContainer>
            </TabsContent>
          )}
        </Tabs>
      )}

      {(is_more_posters_available ||
        is_more_backdrops_available ||
        is_more_clips_available) && (
        <Link
          href={`/${type}/${id}/${urltitle}/media`}
          className="w-fit text-lg hover:opacity-70"
        >
          View All Media
        </Link>
      )}
    </div>
  );
}
