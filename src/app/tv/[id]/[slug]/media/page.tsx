import GoBack from '@/components/GoBack'
import { notFound } from 'next/navigation'
import React from 'react'
import MediaVideos from '@/components/media/MediaVideos'
import MediaImages from '@/components/media/MediaImages'
import ShareButton from '@/components/ShareButton'
export default async function MovieMediaPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const { id, slug } = await params

  const title = decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())

  if (!id) return notFound()
  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <GoBack link={`/tv/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>

      <div className="flex flex-col gap-5 py-3">
        <span className="w-fit text-xl font-semibold md:text-2xl">Videos</span>
        <MediaVideos id={parseInt(id)} media_type="tv" />
      </div>
      <div className="flex flex-col gap-5 py-3 pb-32">
        <span className="w-fit text-xl font-semibold md:text-2xl">Images</span>
        <MediaImages id={parseInt(id)} media_type="tv" />
      </div>
    </section>
  )
}
