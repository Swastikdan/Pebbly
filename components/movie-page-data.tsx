"use client";
import type { Movie } from "@/types";

import React, { cache } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@heroui/spinner";

import { getMovieDetails } from "@/lib/quries";
import { GENRE_LIST } from "@/config/common";
import { IMAGE_PREFIX } from "@/config/image";
import { MediaTitleContailer } from "@/components/media/media-title-container";
import { MediaPosterTrailerContainer } from "@/components/media/media-poster-trailer-container";
import { GenreContainer } from "@/components/media/genre-container";
import { MediaDescription } from "@/components/media/media-description";
import { CastSection } from "@/components/media/cast-section";
import { MediaContainer } from "@/components/media/media-container";
import { Collections } from "@/components/media/collections";
import { MediaKeywords } from "@/components/media/media-keywords";
import { MediaRecomendations } from "@/components/media/media-recommendation";
import { ensureCanonicalSlugAndRedirect } from "@/lib/slug-redirect";
import { formatMediaTitle } from "@/lib/utils";
export function MoviePagedata({
  params,
}: {
  params: { id: string; slug: string };
}) {
  const { id: movie_id, slug: movie_slug } = params;
  const movie_id_param = Number(movie_id);

  const { data, error, isLoading } = useQuery<Movie>({
    queryKey: ["movie_details", movie_id_param],
    queryFn: cache(async () => await getMovieDetails({ id: movie_id_param })),
  });

  if (isLoading) {
    return (
      <div className="grid h-full min-h-screen place-content-center items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data || error) {
    notFound();
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
  } = data;

  ensureCanonicalSlugAndRedirect({
    entity: "movie",
    id: movie_id,
    title: title,
    incomingPathname: `/movie/${movie_id}/${movie_slug}`,
  });
  const urltitle = formatMediaTitle.encode(title);
  const imdb_url = imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null;
  const movietitle = title ?? original_title;
  const movieimage = `${IMAGE_PREFIX.HD_POSTER}${poster_path}`;
  const moviereleaseyear = release_date
    ? new Date(release_date).getFullYear()
    : null;

  const usrelease = release_dates?.results?.find(
    (release) => release.iso_3166_1 === "US",
  );

  let uscertification = "NR";

  if (usrelease?.release_dates) {
    for (const date of usrelease.release_dates) {
      if (date?.certification) {
        uscertification = date.certification;
        break;
      }
    }
  }

  const movieRuntime = runtime
    ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
    : null;

  const moviegenres = genres
    ? genres
        .map((genre) => GENRE_LIST.find((g) => g.id === genre.id))
        .filter((g): g is NonNullable<typeof g> => Boolean(g))
    : [];

  const youtubevideos =
    videos?.results?.map((video) => ({
      key: video.key,
      name: video.name,
      type: video.type,
      published_at: video.published_at,
      official: video.official,
    })) ?? [];

  const trailervideos = youtubevideos
    .filter((v) => v.type === "Trailer" || v.type === "Teaser")
    .sort((a) => (a.type === "Trailer" ? -1 : 1));

  const youtubeclips = youtubevideos
    .filter((v) => v.type !== "Trailer" && v.type !== "Teaser")
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "Featurette" ? -1 : 1;

      return (
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    })
    .slice(0, 10);

  const moviecast =
    credits?.cast
      ?.map((cast) => ({
        id: cast.id,
        name: cast.name,
        profile_path: cast.profile_path!,
        character: cast.character,
      }))
      .slice(0, 10) ?? [];

  const moviecrew =
    credits?.crew
      ?.map((crew) => ({
        id: crew.id,
        name: crew.name,
        profile_path: crew.profile_path!,
        job: crew.job,
      }))
      .slice(0, 10) ?? [];

  const moviebackdrops =
    images?.backdrops
      ?.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .map((image) => ({
        backdrop_image: `${IMAGE_PREFIX.SD_BACKDROP}${image.file_path}`,
        backdrop_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
        aspect_ratio: image.aspect_ratio,
      }))
      .slice(0, 10) ?? [];

  const movieposters =
    images?.posters
      ?.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .slice(0, 10)
      .map((image) => ({
        poster_image: `${IMAGE_PREFIX.SD_POSTER}${image.file_path}`,
        poster_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
        aspect_ratio: image.aspect_ratio,
      }))
      .slice(0, 10) ?? [];

  const moviekeywords =
    keywords?.keywords?.map((k) => ({ name: k.name, id: k.id })) ?? [];

  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <MediaTitleContailer
        Runtime={movieRuntime ?? null}
        description={
          overview.length > 100
            ? overview.slice(0, 100) + "..."
            : overview || ""
        }
        id={id}
        image={movieimage}
        imdb_url={imdb_url}
        media_type="movie"
        poster_path={poster_path}
        rateing={vote_average}
        releaseyear={String(moviereleaseyear) || "Not Released"}
        relese_date={release_date}
        tagline={tagline ?? null}
        title={movietitle}
        uscertification={uscertification}
        vote_average={vote_average}
        vote_count={vote_count}
      />
      <MediaPosterTrailerContainer
        image={movieimage}
        title={movietitle}
        trailervideos={trailervideos}
      />
      <GenreContainer genres={moviegenres} />
      <MediaDescription description={overview} />
      <CastSection
        cast={moviecast}
        crew={moviecrew}
        id={id}
        is_more_cast_crew={
          (credits?.cast?.length ?? 0) > 10 || (credits?.crew?.length ?? 0) > 10
        }
        type="movie"
        urltitle={urltitle}
      />
      <MediaContainer
        backdrops={moviebackdrops}
        id={id}
        is_more_backdrops_available={(images?.backdrops?.length ?? 0) > 10}
        is_more_clips_available={youtubevideos.length > 10}
        is_more_posters_available={(images?.posters?.length ?? 0) > 10}
        posters={movieposters}
        title={movietitle}
        type="movie"
        urltitle={urltitle}
        youtubeclips={youtubeclips}
      />
      {belongs_to_collection && <Collections id={belongs_to_collection.id} />}
      {keywords && <MediaKeywords keywords={moviekeywords} />}
      <MediaRecomendations id={id} type="movie" urltitle={urltitle} />
    </section>
  );
}
