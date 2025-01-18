import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTvDetails, getBasicTvDetails } from '@/lib/gettvdetails'
import { QueryClient } from '@tanstack/react-query'
import { notFound } from 'next/navigation'
import Moviedata from './TvData'
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
  const data = await queryClient
    .fetchQuery({
      queryKey: ['movie_details_basic', id],
      queryFn: () => getBasicTvDetails({ id }),
      staleTime: 1000 * 60 * 60 * 24,
    })
    .catch(() => null)

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
  const data = await queryClient
    .fetchQuery({
      queryKey: ['movie_details', id_param],
      queryFn: async () => await getTvDetails({ id: id_param }),
      staleTime: 1000 * 60 * 60 * 24,
    })
    .catch(() => null)
  if (!data) {
    notFound()
  }
  return (
    <Suspense fallback={<DefaultLoader />}>
      <TvData params={await params} initial_data={data} />
    </Suspense>
  )
}

// export default function page() {
//   return <Suspense fallback={<DefaultLoader />}>
//     <TvData initial_data={}
//   </Suspense>
// }

// import React from 'react'
// import { type Metadata } from 'next'
// import { notFound, redirect } from 'next/navigation'
// import { getTvDetails, getBasicTvDetails } from '@/lib/gettvdetails'
// import { QueryClient } from '@tanstack/react-query'

// import UnderConstruction from '@/components/UnderConstruction'

// const queryClient = new QueryClient()
// export async function generateMetadata({
//   params,
// }: {
//   params: Promise<{ id: string; slug: string }>
// }): Promise<Metadata> {
//   const { id } = await params
//   const id_param = Number(id)
//   let data
//   try {
//     data = await queryClient.fetchQuery({
//       queryKey: ['movie_details_basic', id],
//       queryFn: async () => await getBasicTvDetails({ id: id_param }),
//       staleTime: 1000 * 60 * 60 * 24,
//     })
//   } catch {
//     data = {
//       original_name: 'TV Show',
//       overview: 'A TV Show',
//       poster_path: null,
//       backdrop_path: null,
//     }
//   }

//   const title = data.original_name
//   const description = data.overview
//   const image_slug = data.poster_path ?? data.backdrop_path
//   const metadataimage =
//     image_slug && image_slug !== '' && image_slug !== null
//       ? `https://image.tmdb.org/t/p/w500/${image_slug}`
//       : `https://placehold.co/300x450?text=Image+Not+Found`
//   return {
//     title: title,
//     description: description,
//     openGraph: {
//       type: 'website',
//       title: title,
//       description: description,
//       images: [
//         {
//           url: metadataimage,
//           width: 640,
//           height: 360,
//           alt: title,
//         },
//       ],
//     },
//   }
// }
// export default async function TvSeriesDataPage({
//   params,
// }: {
//   params: Promise<{ id: string; slug: string }>
// }) {
//   const { id: url_id } = await params
//   const id_param = Number(url_id)

//   if (id_param < -2147483648 || id_param > 2147483647) {
//     notFound()
//   }
//   return <UnderConstruction />
// }
