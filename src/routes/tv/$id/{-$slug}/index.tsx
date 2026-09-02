import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { Tv } from "@/lib/tmdb-schemas";
import { DefaultLoader } from "@/components/default-loader";
import {
  DefaultErrorComponent,
  DefaultNotFoundComponent,
} from "@/components/default-not-found";
import { InlineEpisodeBrowser } from "@/components/media/inline-episode-browser";
import { MediaDetailPage } from "@/components/media/media-detail-page";
import { useCanonicalSlugRedirect } from "@/hooks/use-canonical-slug-redirect";
import { buildSharedMediaPageData } from "@/lib/media-page";
import { indexRouteOptions } from "@/lib/media-route-options";
import { getTvCertification } from "@/lib/media-transform";
import { getTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

export const Route = createFileRoute("/tv/$id/{-$slug}/")(
  indexRouteOptions("tv", TvHomePage),
);

function TvHomePage() {
  const { id: tv_id, slug: tv_slug } = Route.useLoaderData();
  const tv_id_param = parseInt(tv_id, 10);
  const { data, error, isLoading } = useQuery<Tv>({
    queryKey: queryKeys.tmdb.tvDetails(tv_id_param),
    queryFn: () => getTvDetails({ id: tv_id_param }),
  });

  useCanonicalSlugRedirect({
    entity: "tv",
    subPageEntity: "home",
    id: data?.id,
    title: data?.name ?? data?.original_name,
    incomingPathname: `/tv/${tv_id}/${tv_slug}`,
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
    genres,
    id,
    external_ids: { imdb_id },
    original_name,
    overview,
    poster_path,
    backdrop_path,
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
  } = data;

  const mediaPage = buildSharedMediaPageData({
    title: name,
    originalTitle: original_name,
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
      entity="tv"
      mediaPage={mediaPage}
      id={id}
      overview={overview}
      posterPath={poster_path}
      backdropPath={backdrop_path}
      releaseDate={release_date}
      tagline={tagline}
      voteAverage={vote_average}
      voteCount={vote_count}
      status={status}
      imdbUrl={imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null}
      certification={getTvCertification(content_ratings?.results)}
      keywords={
        keywords
          ? (keywords.results?.map((keyword) => ({
              name: keyword.name,
              id: keyword.id,
            })) ?? [])
          : null
      }
      hasMoreCastCrew={
        (credits?.cast?.length ?? 0) > 10 || (credits?.crew?.length ?? 0) > 10
      }
      hasMoreBackdrops={(images?.backdrops?.length ?? 0) > 10}
      hasMorePosters={(images?.posters?.length ?? 0) > 10}
      aboveMedia={
        data.seasons && data.seasons.length > 0 ? (
          <InlineEpisodeBrowser
            tvId={id}
            showName={mediaPage.displayTitle}
            seasons={data.seasons}
            image={mediaPage.image}
            release_date={release_date}
            overview={overview}
            rating={vote_average}
            status={status}
          />
        ) : null
      }
    />
  );
}
