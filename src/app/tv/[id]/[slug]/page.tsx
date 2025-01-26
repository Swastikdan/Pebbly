import React, { Suspense, cache } from 'react'
import type { Metadata } from 'next'
import { getBasicTvDetails } from '@/lib/gettvdetails'
import { QueryClient } from '@tanstack/react-query'
import { notFound } from 'next/navigation'
import DefaultLoader from '@/components/DefaultLoader'
import TvData from './TvData'

const queryClient = new QueryClient()

const DEFAULT_METADATA = {
  title: 'TV Show Not Found',
  description: 'Information about this TV Show is currently unavailable.',
  imageUrl: 'https://placehold.co/300x450?text=TV+Show+Not+Found',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}): Promise<Metadata> {
  const id = Number((await params).id)
  if (Number(id) < -2147483648 || Number(id) > 2147483647) {
    return {
      title: DEFAULT_METADATA.title,
      description: DEFAULT_METADATA.description,
      openGraph: {
        type: 'website',
        title: DEFAULT_METADATA.title,
        description: DEFAULT_METADATA.description,
        images: [
          {
            url: DEFAULT_METADATA.imageUrl,
            width: 300,
            height: 450,
            alt: DEFAULT_METADATA.title,
          },
        ],
      },
    }
  }

  const data = await cache(async () =>
    queryClient
      .fetchQuery({
        queryKey: ['movie_details_basic', id],
        queryFn: () => getBasicTvDetails({ id }),
        staleTime: 1000 * 60 * 60 * 24,
      })
      .catch(() => null),
  )()

  const {
    original_name = DEFAULT_METADATA.title,
    overview = DEFAULT_METADATA.description,
    poster_path = null,
    backdrop_path = null,
  } = data ?? {}

  const metadataimage =
    poster_path || backdrop_path
      ? `https://image.tmdb.org/t/p/w500/${poster_path || backdrop_path}`
      : DEFAULT_METADATA.imageUrl

  return {
    title: original_name,
    description: overview,
    openGraph: {
      type: 'website',
      title: original_name,
      description: overview,
      images: [
        {
          url: metadataimage,
          width: 300,
          height: 450,
          alt: original_name,
        },
      ],
    },
  }
}

export default async function TvSeriesDataPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const { id: url_id } = await params
  const id_param = Number(url_id)

  if (id_param < -2147483648 || id_param > 2147483647) {
    notFound()
  }
  return (
    <Suspense fallback={<DefaultLoader />}>
      <TvData params={await params} />
    </Suspense>
  )
}
