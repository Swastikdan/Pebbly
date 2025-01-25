'use client'
import React, { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getMovieDetails } from '@/lib/getmoviedetails'
import { useQuery } from '@tanstack/react-query'
import { Movie } from '@/types/movie'
import DefaultLoader from '@/components/DefaultLoader'
import { GENRE_LIST, IMAGE_PREFIX } from '@/constants'
import MediaTitleContailer from '@/components/media/MediaTitleContailer'
import MediaPosterTrailerContainer from '@/components/media/MediaPosterTrailerContainer'
import GenreContainer from '@/components/media/GenreContainer'
import MediaDescription from '@/components/media/MediaDescription'
import CastSection from '@/components/media/CastSection'
import MediaContainer from '@/components/media/MediaContainer'
import Collections from '@/components/media/Collections'
import MediaKeywords from '@/components/media/MediaKeywords'
import MediaRecomendations from '@/components/media/MediaRecommendation'

export default function Moviedata({
  params,
}: {
  params: { id: string; slug: string }
}) {
  const { id: movie_id, slug: movie_slug } = params
  const movie_id_param = Number(movie_id)
  const { data, error, isLoading } = cache(() =>
    useQuery({
      queryKey: ['movie_details', movie_id_param],
      queryFn: async () => await getMovieDetails({ id: movie_id_param }),
      staleTime: 1000 * 60 * 60 * 24,
    }),
  )()

  if (isLoading) {
    return <DefaultLoader />
  }
  if (!data || error) {
    notFound()
  }

  const {
    belongs_to_collection,
    genres,
    id,
    imdb_id,
    original_title,
    overview,
    poster_path,
    release_date,
    runtime,
    tagline,
    title,
    vote_average,
    vote_count,
    images,
    credits,
    videos,
    release_dates,
    keywords,
  } = data
  const urltitle = encodeURIComponent(title.replace(/ /g, '-').toLowerCase())
  const accepted_params = [
    urltitle,
    `${urltitle}/media`,
    `${urltitle}/cast-crew`,
    `${urltitle}/recommendations`,
  ]
  if (movie_slug && !accepted_params.includes(movie_slug)) {
    redirect(`/movie/${id}/${urltitle}`)
  }

  const imdb_url = imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null
  const movietitle = title ?? original_title
  const movieimage =
    poster_path && poster_path !== '' && poster_path !== null
      ? `${IMAGE_PREFIX.HD_POSTER}${poster_path}`
      : `https://placehold.co/300x450?text=Image+Not+Found`
  const moviereleaseyear = release_date
    ? new Date(release_date).getFullYear()
    : null
  const usrelease = release_dates?.results?.find(
    (release) => release.iso_3166_1 === 'US',
  )
  let uscertification = 'NR'

  if (usrelease && usrelease.release_dates) {
    for (let i = 0; i < usrelease.release_dates.length; i++) {
      if (usrelease.release_dates[i].certification) {
        uscertification = usrelease.release_dates[i].certification
        break
      }
    }
  }
  const movieRuntime = runtime
    ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
    : null
  const moviegenres = genres
    ? genres
        .map((genre) => {
          return GENRE_LIST.find(
            (genreListItem) => genreListItem.id === genre.id,
          )
        })
        .filter((genre) => genre !== undefined)
    : []

  const youtubevideos =
    videos?.results?.map((video) => ({
      key: video.key,
      name: video.name,
      type: video.type,
      published_at: video.published_at,
      official: video.official,
    })) ?? []

  // get only the trailers from the youtube videos type = "Trailer" || "Teaser"
  const trailervideos = youtubevideos
    ?.filter((video) => video.type === 'Trailer' || video.type === 'Teaser')
    .sort((a) => {
      return a.type === 'Trailer' ? -1 : 1
    })
  const youtubeclips = youtubevideos
    .filter((video) => video.type !== 'Trailer' && video.type !== 'Teaser')
    .sort((a, b) => {
      // First sort by type (Featurette takes priority)
      if (a.type !== b.type) {
        return a.type === 'Featurette' ? -1 : 1
      }
      // Then sort by published date (newest first)
      return (
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      )
    })
    .slice(0, 10) // Slice after sorting to get the top 10

  const moviecast =
    credits?.cast
      ?.map((cast) => ({
        id: cast.id,
        name: cast.name,
        profile_path: cast.profile_path!,
        character: cast.character,
      }))
      .slice(0, 10) ?? []
  const moviecrew =
    credits?.crew
      ?.map((crew) => ({
        id: crew.id,
        name: crew.name,
        profile_path: crew.profile_path!,
        job: crew.job,
      }))
      .slice(0, 10) ?? []

  const moviebackdrops =
    images?.backdrops
      ?.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .map((image) => ({
        backdrop_image: `${IMAGE_PREFIX.SD_BACKDROP}${image.file_path}`,
        backdrop_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
        aspect_ratio: image.aspect_ratio,
      }))
      .slice(0, 10) ?? []

  const movieposters =
    images?.posters
      ?.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .slice(0, 10)
      .map((image) => ({
        poster_image: `${IMAGE_PREFIX.SD_POSTER}${image.file_path}`,
        poster_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
        aspect_ratio: image.aspect_ratio,
      }))
      .slice(0, 10) ?? []

  const moviekeywords =
    keywords?.keywords?.map((keyword) => ({
      name: keyword.name,
      id: keyword.id,
    })) ?? []

  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <MediaTitleContailer
        title={movietitle}
        rateing={vote_average}
        image={movieimage}
        poster_path={poster_path}
        id={id}
        media_type="movie"
        relese_date={release_date}
        description={
          overview.length > 100
            ? overview.slice(0, 100) + '...'
            : overview || ''
        }
        tagline={tagline ?? null}
        releaseyear={String(moviereleaseyear) || 'Not Released'}
        uscertification={uscertification}
        Runtime={movieRuntime ?? null}
        vote_average={vote_average}
        vote_count={vote_count}
        imdb_url={imdb_url}
      />
      <MediaPosterTrailerContainer
        image={movieimage}
        title={movietitle}
        trailervideos={trailervideos}
      />
      <GenreContainer genres={moviegenres} />
      <MediaDescription description={overview} />
      <CastSection
        id={id}
        urltitle={urltitle}
        cast={moviecast}
        crew={moviecrew}
        is_more_cast_crew={
          credits?.cast?.length! > 10 || (credits?.crew?.length ?? 0) > 10
        }
        type="movie"
      />
      <MediaContainer
        id={id}
        urltitle={urltitle}
        backdrops={moviebackdrops}
        posters={movieposters}
        title={movietitle}
        youtubeclips={youtubeclips}
        is_more_backdrops_available={images?.backdrops?.length! > 10}
        is_more_posters_available={images?.posters?.length! > 10}
        is_more_clips_available={youtubevideos.length > 10}
        type="movie"
      />
      {belongs_to_collection && <Collections id={belongs_to_collection.id} />}
      {keywords && <MediaKeywords keywords={moviekeywords} />}
      <MediaRecomendations type="movie" id={id} urltitle={urltitle} />
    </section>
  )
}
