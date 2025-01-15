import React from 'react'
import UnderConstruction from '@/components/UnderConstruction'
export default function page() {
  return <UnderConstruction />
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
