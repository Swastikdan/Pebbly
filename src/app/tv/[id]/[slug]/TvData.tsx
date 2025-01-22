'use client'
import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { getTvDetails } from '@/lib/gettvdetails'
import { useQuery } from '@tanstack/react-query'
import { SeasonsEntity, Tv } from '@/types/tv'
import DefaultLoader from '@/components/DefaultLoader'
import { GENRE_LIST, IMAGE_PREFIX } from '@/constants'
import MediaTitleContailer from '@/components/media/MediaTitleContailer'
import MediaPosterTrailerContainer from '@/components/media/MediaPosterTrailerContainer'
import GenreContainer from '@/components/media/GenreContainer'
import MediaDescription from '@/components/media/MediaDescription'
import CastSection from '@/components/media/CastSection'
import MediaContainer from '@/components/media/MediaContainer'
import MediaKeywords from '@/components/media/MediaKeywords'
import MediaRecomendations from '@/components/media/MediaRecomendations'
import CurrentSeason from '@/components/media/CurrentSeason'

export default function TvData({
  params,
  initial_data,
}: {
  params: { id: string; slug: string }
  initial_data: Tv
}) {
  const { id: tv_id, slug: tv_slug } = params
  const tv_id_param = Number(tv_id)
  const { data, error, isLoading } = useQuery({
    queryKey: ['tv_details', tv_id_param],
    queryFn: async () => await getTvDetails({ id: tv_id_param }),
    staleTime: 1000 * 60 * 60 * 24,
    initialData: initial_data,
  })

  if (isLoading) {
    return <DefaultLoader />
  }
  if (error) {
    notFound()
  }

  const {
    genres,
    id,
    external_ids: { imdb_id },
    original_name,
    overview,
    poster_path,
    first_air_date: release_date,
    content_ratings,
    tagline,
    name,
    vote_average,
    vote_count,
    images,
    credits,
    videos,
    status,
    keywords,
  } = data
  const urltitle = encodeURIComponent(name.replace(/ /g, '-').toLowerCase())
  const accepted_params = [
    urltitle,
    `${urltitle}/media`,
    `${urltitle}/cast-crew`,
    `${urltitle}/recommendations`,
  ]
  if (tv_slug && !accepted_params.includes(tv_slug)) {
    redirect(`/tv/${id}/${urltitle}`)
  }

  const imdb_url = imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null
  const tvtitle = name ?? original_name
  const tvimage =
    poster_path && poster_path !== '' && poster_path !== null
      ? `https://image.tmdb.org/t/p/w500/${poster_path}`
      : `https://placehold.co/300x450?text=Image+Not+Found`
  const tvreleaseyear = release_date
    ? new Date(release_date).getFullYear()
    : null
  // const usrelease = release_dates?.results?.find(
  //   (release) => release.iso_3166_1 === 'US',
  // )
  // let uscertification = 'NR'

  // if (usrelease && usrelease.release_dates) {
  //   for (let i = 0; i < usrelease.release_dates.length; i++) {
  //     if (usrelease.release_dates[i].certification) {
  //       uscertification = usrelease.release_dates[i].certification
  //       break
  //     }
  //   }
  // }
  // const rating: string =
  // tv.content_ratings?.results.find((result) => result.iso_3166_1 === "US")
  //   ?.rating || "NR";

  const uscertification =
    content_ratings?.results?.find((result) => result.iso_3166_1 === 'US')
      ?.rating ?? 'NR'

  const tvgenres = genres
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

  const tvcast =
    credits?.cast
      ?.map((cast) => ({
        id: cast.id,
        name: cast.name,
        profile_path: cast.profile_path!,
        character: cast.character,
      }))
      .slice(0, 10) ?? []
  const tvcrew =
    credits?.crew
      ?.map((crew) => ({
        id: crew.id,
        name: crew.name,
        profile_path: crew.profile_path!,
        job: crew.job,
      }))
      .slice(0, 10) ?? []

  const tvbackdrops =
    images?.backdrops
      ?.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .map((image) => ({
        backdrop_image: `${IMAGE_PREFIX.SD_BACKDROP}${image.file_path}`,
        backdrop_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
        aspect_ratio: image.aspect_ratio,
      }))
      .slice(0, 10) ?? []

  const tvposters =
    images?.posters
      ?.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .slice(0, 10)
      .map((image) => ({
        poster_image: `${IMAGE_PREFIX.SD_POSTER}${image.file_path}`,
        poster_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
        aspect_ratio: image.aspect_ratio,
      }))
      .slice(0, 10) ?? []

  const tvkeywords =
    keywords?.results?.map((keyword) => ({
      name: keyword.name,
      id: keyword.id,
    })) ?? []

  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <MediaTitleContailer
        title={tvtitle}
        rateing={vote_average}
        image={tvimage}
        id={id}
        media_type="tv"
        relese_date={release_date}
        description={
          overview.length > 100
            ? overview.slice(0, 100) + '...'
            : overview || ''
        }
        tagline={tagline ?? null}
        releaseyear={String(tvreleaseyear) || 'Not Released'}
        uscertification={uscertification}
        Runtime={null}
        vote_average={vote_average}
        vote_count={vote_count}
        imdb_url={imdb_url}
        tv_status={status}
      />
      <MediaPosterTrailerContainer
        image={tvimage}
        title={tvtitle}
        trailervideos={trailervideos}
      />
      <GenreContainer genres={tvgenres} />
      <MediaDescription description={overview} />
      <CastSection
        id={id}
        urltitle={urltitle}
        cast={tvcast}
        crew={tvcrew}
        is_more_cast_crew={
          credits?.cast?.length! > 10 || (credits?.crew?.length ?? 0) > 10
        }
        type="tv"
      />
      {data.seasons && data.seasons.length > 0 && (
        <CurrentSeason
          id={id}
          urltitle={urltitle}
          season_data={
            data.seasons && data.seasons.length > 0
              ? data.seasons
                  .slice()
                  .reverse()
                  .find(
                    (season) =>
                      season.air_date &&
                      new Date(season.air_date).getTime() <=
                        new Date().getTime(),
                  ) || data.seasons[data.seasons.length - 1]
              : ({} as SeasonsEntity)
          }
        />
      )}

      <MediaContainer
        id={id}
        urltitle={urltitle}
        backdrops={tvbackdrops}
        posters={tvposters}
        title={tvtitle}
        youtubeclips={youtubeclips}
        is_more_backdrops_available={images?.backdrops?.length! > 10}
        is_more_posters_available={images?.posters?.length! > 10}
        is_more_clips_available={youtubevideos.length > 10}
      />

      {keywords && <MediaKeywords keywords={tvkeywords} />}
      <MediaRecomendations type="tv" id={id} />
    </section>
  )
}
