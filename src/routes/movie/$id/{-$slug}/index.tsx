import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { Movie } from "@/lib/tmdb-schemas";
import { DefaultLoader } from "@/components/default-loader";
import {
  DefaultErrorComponent,
  DefaultNotFoundComponent,
} from "@/components/default-not-found";
import { Collections } from "@/components/media/collections";
import { MediaDetailPage } from "@/components/media/media-detail-page";
import { useCanonicalSlugRedirect } from "@/hooks/use-canonical-slug-redirect";
import { buildSharedMediaPageData } from "@/lib/media-page";
import { indexRouteOptions } from "@/lib/media-route-options";
import {
  formatRuntime,
  getMovieCertification,
  isInTheatricalWindow,
} from "@/lib/media-transform";
import { getMovieDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

export const Route = createFileRoute("/movie/$id/{-$slug}/")(
  indexRouteOptions("movie", MovieHomePage),
);

function MovieHomePage() {
  const { id: movie_id, slug: movie_slug } = Route.useLoaderData();
  const movie_id_param = parseInt(movie_id, 10);
  const { data, error, isLoading } = useQuery<Movie>({
    queryKey: queryKeys.tmdb.movieDetails(movie_id_param),
    queryFn: () => getMovieDetails({ id: movie_id_param }),
  });
  useCanonicalSlugRedirect({
    entity: "movie",
    subPageEntity: "home",
    id: data?.id,
    title: data?.title ?? data?.original_title,
    incomingPathname: `/movie/${movie_id}/${movie_slug}`,
    isLoading,
  });
  if (isLoading) {
    return <DefaultLoader />;
  }

  if (error) {
    return <DefaultErrorComponent />;
  }
  if (!data) {
    return <DefaultNotFoundComponent />;
  }

  const {
    belongs_to_collection,
    genres,
    id,
    imdb_id,
    original_title,
    overview,
    poster_path,
    backdrop_path,
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

  const mediaPage = buildSharedMediaPageData({
    title,
    originalTitle: original_title,
    posterPath: poster_path,
    releaseDate: release_date,
    genres,
    images,
    credits,
    videos,
  });

  return (
    <MediaDetailPage
      key={id}
      entity="movie"
      mediaPage={mediaPage}
      id={id}
      overview={overview}
      posterPath={poster_path}
      backdropPath={backdrop_path}
      releaseDate={release_date}
      tagline={tagline}
      voteAverage={vote_average}
      voteCount={vote_count}
      runtime={formatRuntime(runtime)}
      imdbUrl={imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null}
      certification={getMovieCertification(release_dates?.results)}
      inTheaters={isInTheatricalWindow(release_date, release_dates?.results)}
      keywords={
        keywords
          ? (keywords.keywords?.map((k) => ({ name: k.name, id: k.id })) ?? [])
          : null
      }
      hasMoreCastCrew={
        (credits?.cast?.length ?? 0) > 10 || (credits?.crew?.length ?? 0) > 10
      }
      hasMoreBackdrops={(images?.backdrops?.length ?? 0) > 10}
      hasMorePosters={(images?.posters?.length ?? 0) > 10}
      belowMedia={
        belongs_to_collection ? (
          <Collections id={belongs_to_collection.id} />
        ) : null
      }
    />
  );
}
