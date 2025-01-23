'use client'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollContainer } from '@/components/ScrollContainer'
import Image from '@/components/Image'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog'
import { getImages } from '@/lib/getImages'
import { Skeleton } from '@/components/ui/skeleton'
import { IMAGE_PREFIX } from '@/constants'

export default function MediaImages({
  id,
  media_type,
}: {
  id: number
  media_type: 'movie' | 'tv'
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['media_images', id, media_type],
    queryFn: async () => getImages({ id, type: media_type }),
    staleTime: 1000 * 60 * 60 * 24,
  })

  return (
    <div className="flex flex-col gap-3">
      <span className="w-fit text-lg md:text-xl">Backdrops</span>
      <ScrollContainer isButtonsVisible={!isLoading}>
        <div className="flex items-center justify-center gap-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="aspect-video h-44 w-auto rounded-xl bg-accent md:h-52 lg:h-60"
                />
              ))
            : data &&
              data.backdrops?.map((image, index) => (
                <Dialog key={index}>
                  <DialogTrigger asChild>
                    <Image
                      key={index}
                      src={IMAGE_PREFIX.SD_BACKDROP + image.file_path}
                      alt={image.file_path}
                      width={300}
                      height={450}
                      quality={100}
                      className="aspect-video h-44 w-auto cursor-pointer rounded-xl bg-accent object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70 md:h-52 lg:h-60"
                    />
                  </DialogTrigger>
                  <DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
                    <DialogContent className="aspect-video w-full max-w-5xl rounded-2xl border-0 bg-transparent p-0 ring-0">
                      <DialogHeader className="sr-only">
                        <DialogTitle>
                          {image.file_path} Backdrop Image
                        </DialogTitle>
                      </DialogHeader>
                      <div className="relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] bg-accent p-0">
                        <Image
                          src={IMAGE_PREFIX.ORIGINAL + image.file_path}
                          alt={image.file_path}
                          width={450}
                          height={300}
                          className="aspect-video size-full rounded-2xl object-cover"
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
                  className="aspect-video h-44 w-auto rounded-xl bg-accent md:h-52 lg:h-60"
                />
              ))
            : data &&
              data.posters?.map((image, index) => (
                <Dialog key={index}>
                  <DialogTrigger asChild>
                    <Image
                      key={index}
                      src={IMAGE_PREFIX.SD_POSTER + image.file_path}
                      alt={image.file_path}
                      width={450}
                      height={300}
                      quality={100}
                      className="aspect-[11/16] h-44 w-auto cursor-pointer rounded-xl bg-accent object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 dark:hover:opacity-70 md:h-52 lg:h-60"
                    />
                  </DialogTrigger>

                  <DialogContent className="aspect-[11/16] h-auto max-h-[90vh] w-full max-w-[90vw] rounded-2xl border-0 bg-transparent p-0 ring-0 sm:h-full sm:w-auto">
                    <DialogHeader className="sr-only">
                      <DialogTitle>{image.file_path} Poster Image</DialogTitle>
                    </DialogHeader>
                    <div className="relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] bg-accent p-0">
                      <Image
                        src={IMAGE_PREFIX.ORIGINAL + image.file_path}
                        alt={image.file_path}
                        width={450}
                        height={300}
                        className="aspect-[11/16] h-auto w-full rounded-2xl object-center"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
        </div>
      </ScrollContainer>
    </div>
  )
}
