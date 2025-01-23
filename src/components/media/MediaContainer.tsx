import React from 'react'
import Link from 'next/link'
import { ArrowRight, Play } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollContainer } from '@/components/ScrollContainer'
import Image from '@/components/Image'

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
}: {
  id: number
  urltitle: string
  youtubeclips: any[]
  backdrops: any[]
  posters: any[]
  title: string
  is_more_posters_available: boolean
  is_more_backdrops_available: boolean
  is_more_clips_available: boolean
  type: 'movie' | 'tv'
}) {
  return (
    <div className="pb-5">
      <Tabs
        defaultValue={
          youtubeclips.length > 0
            ? 'videos'
            : backdrops.length > 0
              ? 'backdrops'
              : posters.length > 0
                ? 'posters'
                : 'videos'
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

          <TabsList className="h-8 rounded-xl border border-input bg-background p-0 sm:h-9">
            {youtubeclips.length > 0 && (
              <TabsTrigger
                value="videos"
                className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none md:rounded-2xl md:px-10"
              >
                Videos
              </TabsTrigger>
            )}
            {backdrops.length > 0 && (
              <TabsTrigger
                value="backdrops"
                className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none md:rounded-2xl md:px-10"
              >
                Backdrops
              </TabsTrigger>
            )}
            {posters.length > 0 && (
              <TabsTrigger
                value="posters"
                className="h-full w-full rounded-xl px-5 data-[state=active]:bg-accent data-[state=active]:shadow-none md:rounded-2xl md:px-10"
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
                          className="aspect-video h-44 w-auto rounded-xl bg-accent object-cover md:h-52 lg:h-60"
                        />
                        <span className="absolute left-4 top-4 truncate text-xs text-white md:text-sm">
                          {video.name.slice(0, 30) +
                            (video.name.length > 30 ? '...' : '')}
                        </span>
                        <button className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full bg-black/60 p-4 transition-transform group-hover:scale-110">
                            <Play
                              className="size-8 scale-100 fill-white text-white transition-transform duration-200 ease-out group-hover:scale-105"
                              style={{
                                filter:
                                  'drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06))',
                              }}
                            />
                          </div>
                        </button>
                      </div>
                    </DialogTrigger>

                    <DialogContent className="aspect-video w-full max-w-5xl rounded-2xl border-0 bg-transparent p-0 ring-0">
                      <DialogHeader className="sr-only">
                        <DialogTitle>{video.name}</DialogTitle>
                      </DialogHeader>
                      <div className="relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] bg-accent p-0">
                        <iframe
                          src={`https://www.youtube.com/embed/${video.key}`}
                          className="size-full rounded-2xl"
                          allowFullScreen
                          allow="accelerometer;encrypted-media; gyroscope; picture-in-picture;"
                        ></iframe>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
                {is_more_clips_available && (
                  <Link href={`/${type}/${id}/${urltitle}/media`}>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="ml-5 mr-10 flex items-center justify-center"
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
                        src={image.backdrop_image}
                        alt={title}
                        width={300}
                        height={450}
                        quality={100}
                        className="aspect-video h-44 w-auto cursor-pointer rounded-xl bg-accent object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70 md:h-52 lg:h-60"
                      />
                    </DialogTrigger>
                    <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
                      <DialogContent className="aspect-video w-full max-w-5xl rounded-2xl border-0 bg-transparent p-0 ring-0">
                        <DialogHeader className="sr-only">
                          <DialogTitle>{title} Backdrop Image</DialogTitle>
                        </DialogHeader>
                        <div className="relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] bg-accent p-0">
                          <Image
                            unoptimized
                            src={image.backdrop_image_raw}
                            alt={title}
                            width={450}
                            height={300}
                            className="aspect-video size-full rounded-2xl object-cover"
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
                      className="ml-5 mr-10 flex items-center justify-center"
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
                        src={image.poster_image}
                        alt={title}
                        width={450}
                        height={300}
                        quality={100}
                        className="aspect-[11/16] h-44 w-auto cursor-pointer rounded-xl bg-accent object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70 md:h-52 lg:h-60"
                      />
                    </DialogTrigger>

                    <DialogContent className="aspect-[11/16] h-auto max-h-[90vh] w-full max-w-[90vw] rounded-2xl border-0 bg-transparent p-0 ring-0 sm:h-full sm:w-auto">
                      <DialogHeader className="sr-only">
                        <DialogTitle>{title} Poster Image</DialogTitle>
                      </DialogHeader>
                      <div className="relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] bg-accent p-0">
                        <Image
                          unoptimized
                          src={image.poster_image_raw}
                          width={450}
                          height={300}
                          alt={title}
                          className="aspect-[11/16] h-auto w-full rounded-2xl object-center"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
                {is_more_posters_available && (
                  <Link href={`/${type}/${id}/${urltitle}/media`}>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="ml-5 mr-10 flex items-center justify-center"
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
      {is_more_posters_available ||
        is_more_backdrops_available ||
        (is_more_clips_available && (
          <Link
            href={`/${type}/${id}/${urltitle}/media`}
            className="w-fit text-lg hover:opacity-70"
          >
            View All Media
          </Link>
        ))}
      {/* {((videos.results?.length ?? 0) > 0 ||
        (images.backdrops?.length ?? 0) > 0 ||
        (images.posters?.length ?? 0) > 0) && (
        <Link
          href={`/${type}/${id}/${urltitle}/media`}
          className="w-fit text-lg hover:opacity-70"
        >
          View All Media
        </Link>
      )} */}
    </div>
  )
}
