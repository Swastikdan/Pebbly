import React from 'react'
import Image from '@/components/Image'
import { IMAGE_PREFIX } from '@/constants'
export default function HeroPoster({
  image_slug,
  title,
  quality,
}: {
  image_slug: string
  title: string
  quality?: 'original' | 'HD' | 'SD' | 'LQ'
}) {
  const movieimage = image_slug
    ? `${IMAGE_PREFIX}${quality ? quality : 'original'}${image_slug}`
    : `https://placehold.co/300x450?text=Image+Not+Found`
  return (
    <Image
      src={movieimage}
      alt={title}
      width={300}
      height={450}
      quality={100}
      className="md:h-70 aspect-[11/16] h-full w-full rounded-xl bg-accent object-center sm:h-56 sm:w-auto lg:h-80"
    />
  )
}
