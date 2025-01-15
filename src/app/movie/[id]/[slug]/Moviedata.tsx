'use client'
import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { getMovieDetails, getBasicMovieDetails } from '@/lib/getmoviedetails'
import { useQuery } from '@tanstack/react-query'
export default function Moviedata({
  params,
}: {
  params: { id: string; slug: string }
}) {
  const { id: movie_id, slug: movie_slug } = params
  const movie_id_param = Number(movie_id)
  const { data, error, isLoading } = useQuery({
    queryKey: ['movie_details_basic', movie_id_param, movie_slug],
    queryFn: async () => await getBasicMovieDetails({ id: movie_id_param }),
    staleTime: 1000 * 60 * 60 * 24,
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  return <div>Moviedata</div>
}
