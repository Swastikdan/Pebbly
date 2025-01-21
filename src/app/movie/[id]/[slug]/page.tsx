import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getMovieDetails, getBasicMovieDetails } from '@/lib/getmoviedetails'
import { QueryClient } from '@tanstack/react-query'
import { notFound } from 'next/navigation'
import Moviedata from './Moviedata'
import DefaultLoader from '@/components/DefaultLoader'

const queryClient = new QueryClient()

const DEFAULT_METADATA = {
  title: 'Movie Not Found',
  description: 'Information about this movie is currently unavailable.',
  imageUrl: 'https://placehold.co/300x450?text=Movie+Not+Found',
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
      queryFn: () => getBasicMovieDetails({ id }),
      staleTime: 1000 * 60 * 60 * 24,
    })
    .catch(() => null)

  const {
    original_title = DEFAULT_METADATA.title,
    overview = DEFAULT_METADATA.description,
    poster_path = null,
    backdrop_path = null,
  } = data ?? {}

  const metadataimage =
    poster_path || backdrop_path
      ? `https://image.tmdb.org/t/p/w500/${poster_path || backdrop_path}`
      : DEFAULT_METADATA.imageUrl

  return {
    title: original_title,
    description: overview,
    openGraph: {
      type: 'website',
      title: original_title,
      description: overview,
      images: [
        {
          url: metadataimage,
          width: 300,
          height: 450,
          alt: original_title,
        },
      ],
    },
  }
}
export default async function page({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const id = Number((await params).id)

  if (Number(id) < -2147483648 || Number(id) > 2147483647) {
    notFound()
  }
  const data = await queryClient
    .fetchQuery({
      queryKey: ['movie_details', id],
      queryFn: () => getMovieDetails({ id }),
      staleTime: 1000 * 60 * 60 * 24,
    })
    .catch(() => null)
  if (!data) {
    notFound()
  }

  return (
    <Suspense fallback={<DefaultLoader />}>
      <Moviedata params={await params} initial_data={data} />
    </Suspense>
  )
}

// import React, { Suspense } from 'react'
// import { type Metadata } from 'next'
// import { notFound, redirect } from 'next/navigation'
// import { getMovieDetails, getBasicMovieDetails } from '@/lib/getmoviedetails'
// import { QueryClient } from '@tanstack/react-query'

// import UnderConstruction from '@/components/UnderConstruction'
// import Moviedata from './Moviedata'

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
//       queryFn: async () => await getBasicMovieDetails({ id: id_param }),
//       staleTime: 1000 * 60 * 60 * 24,
//     })
//   } catch (error) {
//     // Default fallback data
//     data = {
//       original_title: 'Movie Not Found',
//       overview: 'Information about this movie is currently unavailable.',
//       poster_path: null,
//       backdrop_path: null,
//     }
//   }

//   const title = data?.original_title ?? 'Movie Not Found'
//   const description =
//     data?.overview ?? 'Information about this movie is currently unavailable.'
//   const image_slug = data?.poster_path ?? data?.backdrop_path ?? null
//   const defaultImage = 'https://placehold.co/300x450?text=Movie+Not+Found'
//   const metadataimage = image_slug
//     ? `https://image.tmdb.org/t/p/w500/${image_slug}`
//     : defaultImage

//   return {
//     title,
//     description,
//     openGraph: {
//       type: 'website',
//       title,
//       description,
//       images: [
//         {
//           url: metadataimage,
//           width: 300,
//           height: 450,
//           alt: title,
//         },
//       ],
//     },
//   }
// }

// export default async function MovieDetailsPage({
//   params,
// }: {
//   params: Promise<{ id: string; slug: string }>
// }) {
//   const { id, slug } = await params
//   const id_param = Number(id)
//   const title_param = slug
//   const page_params = { id, slug }

//   if (Number(id_param) < -2147483648 || Number(id_param) > 2147483647) {
//     notFound()
//   }
//   let data
//   try {
//     data = await queryClient.fetchQuery({
//       queryKey: ['movie_details_basic', id_param],
//       queryFn: async () => await getBasicMovieDetails({ id: id_param }),
//       staleTime: 1000 * 60 * 60 * 24,
//     })
//   } catch {
//     notFound()
//   }

//   const urltitle = encodeURIComponent(
//     data.title.replace(/ /g, '-').toLowerCase(),
//   )
//   const accepted_params = [
//     urltitle,
//     `${urltitle}/media`,
//     `${urltitle}/cast-crew`,
//     `${urltitle}/recommendations`,
//   ]
//   if (title_param && !accepted_params.includes(title_param)) {
//     redirect(`/movie/${id}/${urltitle}`)
//   }

//   return (
//     <>
//       <Suspense fallback={<UnderConstruction />}>
//         <Moviedata params={page_params} />
//       </Suspense>
//     </>
//   )
// }
