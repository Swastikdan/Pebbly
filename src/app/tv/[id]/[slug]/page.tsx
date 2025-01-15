import React from 'react'
import UnderConstruction from '@/components/UnderConstruction'
export default function page() {
  return <UnderConstruction />
}

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
