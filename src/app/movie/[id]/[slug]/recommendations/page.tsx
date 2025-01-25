export const runtime = 'edge'
import type { Metadata } from 'next'
import GoBack from '@/components/GoBack'
import { notFound } from 'next/navigation'
import ShareButton from '@/components/ShareButton'
import MediaRecommendationpageContainer from '@/components/media/MediaRecommendationpageContainer'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}): Promise<Metadata> {
  const title = decodeURIComponent((await params).slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
  return {
    title: `${title} - Recommendations`,
    description: `Recomendations for ${title}`,
  }
}

export default async function TvRecommendationsPage({
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
          <GoBack link={`/movie/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title} | Recomendations
        </h1>
      </div>
      <div className="py-">
        <MediaRecommendationpageContainer id={Number(id)} type="movie" />
      </div>
    </section>
  )
}
