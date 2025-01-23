import GoBack from '@/components/GoBack'
import { notFound } from 'next/navigation'
import React from 'react'
import SeasonContainer from './SeasonContainer'
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
          <div></div>
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>
      <SeasonContainer tv_id_param={parseInt(id)} id={id} urltitle={slug} />
    </section>
  )
}
