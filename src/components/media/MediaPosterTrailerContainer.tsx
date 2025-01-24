import React from 'react'
import Image from '@/components/Image'
import { Play } from 'lucide-react'
import {
  Dialog,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from '@/components/ui/dialog'
import { ScrollContainer } from '@/components/ScrollContainer'
export default function MediaPosterTrailerContainer({
  image,
  title,
  trailervideos,
}: {
  image: string
  title: string
  trailervideos: Array<{ key: string; name: string }>
}) {
  return (
    <div className="flex flex-col justify-start gap-3 pb-3 sm:flex-row">
      <Image
        src={image}
        alt={title}
        width={300}
        height={450}
        className="md:h-70 aspect-[11/16] h-full w-full rounded-xl bg-accent object-center sm:h-56 sm:w-auto lg:h-80"
      />

      {trailervideos.length > 0 ? (
        <ScrollContainer className="h-full flex-1">
          <div className="flex h-full gap-3">
            {trailervideos.map((video, index) => (
              <Dialog key={index}>
                <DialogTrigger asChild>
                  <div className="group relative cursor-pointer">
                    <Image
                      src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
                      width={300}
                      height={450}
                      quality={100}
                      alt={video.name}
                      className="md:h-70 aspect-video h-48 w-auto rounded-xl bg-accent object-cover sm:h-56 lg:h-80"
                    />
                    <span className="absolute left-4 top-4 truncate text-base font-semibold text-white">
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
                <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
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
                </DialogOverlay>
              </Dialog>
            ))}
          </div>
        </ScrollContainer>
      ) : (
        <div className="md:h-70 hidden aspect-video h-0 w-full items-center justify-center rounded-xl bg-accent object-cover text-center sm:h-56 md:flex lg:h-80">
          <span className="text-lg font-medium text-muted-foreground">
            No Trailer Available
          </span>
        </div>
      )}
    </div>
  )
}
