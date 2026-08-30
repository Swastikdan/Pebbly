import type { ReactNode } from "react";

import type { MediaType } from "@/domain/media";
import type { buildSharedMediaPageData } from "@/lib/media-page";
import { CastSection } from "@/components/media/cast-section";
import { GenreContainer } from "@/components/media/genre-container";
import { MediaContainer } from "@/components/media/media-container";
import { MediaDescription } from "@/components/media/media-description";
import { MediaKeywords } from "@/components/media/media-keywords";
import { MediaPosterTrailerContainer } from "@/components/media/media-poster-trailer-container";
import { MediaRecommendations } from "@/components/media/media-recommendation";
import { MediaTitleContainer } from "@/components/media/media-title-container";
import { MediaWatchProviders } from "@/components/media/media-watch-providers";

type SharedMediaPageData = ReturnType<typeof buildSharedMediaPageData>;

export function MediaDetailPage(props: {
  entity: MediaType;
  mediaPage: SharedMediaPageData;
  id: number;
  overview: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate: string | null;
  tagline?: string | null;
  voteAverage: number;
  voteCount: number | null;
  runtime?: string | null;
  status?: string | null;
  imdbUrl?: string | null;
  certification: string;
  keywords: { id: number; name: string }[] | null;
  inTheaters?: boolean;
  hasMoreCastCrew: boolean;
  hasMoreBackdrops: boolean;
  hasMorePosters: boolean;
  aboveMedia?: ReactNode;
  belowMedia?: ReactNode;
}) {
  const { entity, mediaPage } = props;
  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <MediaTitleContainer
        runtime={props.runtime ?? null}
        description={`${props.overview?.slice(0, 100)}...`}
        id={props.id}
        image={mediaPage.image}
        imdb_url={props.imdbUrl}
        media_type={entity}
        poster_path={props.posterPath}
        backdrop_path={props.backdropPath ?? undefined}
        rating={props.voteAverage}
        releaseyear={
          mediaPage.releaseYear != null &&
          Number.isFinite(mediaPage.releaseYear)
            ? String(mediaPage.releaseYear)
            : "Not Released"
        }
        release_date={props.releaseDate}
        tagline={props.tagline ?? null}
        title={mediaPage.displayTitle}
        tv_status={props.status}
        uscertification={props.certification}
        vote_average={props.voteAverage}
        vote_count={props.voteCount}
      />
      <MediaPosterTrailerContainer
        tmdbId={props.id}
        type={entity}
        image={mediaPage.image}
        title={mediaPage.displayTitle}
        trailervideos={mediaPage.trailervideos}
      />
      <GenreContainer genres={mediaPage.genres} />
      <MediaWatchProviders
        id={props.id}
        type={entity}
        inTheaters={props.inTheaters}
      />
      <MediaDescription description={props.overview} />
      <CastSection
        cast={mediaPage.cast}
        crew={mediaPage.crew}
        id={props.id}
        is_more_cast_crew={props.hasMoreCastCrew}
        type={entity}
        urltitle={mediaPage.urltitle}
      />
      {props.aboveMedia}
      <MediaContainer
        backdrops={mediaPage.backdrops}
        id={props.id}
        is_more_backdrops_available={props.hasMoreBackdrops}
        is_more_clips_available={mediaPage.allVideos.length > 10}
        is_more_posters_available={props.hasMorePosters}
        posters={mediaPage.posters}
        title={mediaPage.displayTitle}
        type={entity}
        urltitle={mediaPage.urltitle}
        youtubeclips={mediaPage.youtubeclips}
      />
      {props.belowMedia}
      {props.keywords !== null && <MediaKeywords keywords={props.keywords} />}
      <MediaRecommendations
        id={props.id}
        type={entity}
        urltitle={mediaPage.urltitle}
      />
    </section>
  );
}
