import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import type { Tv } from "@/lib/tmdb-schemas";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX, VITE_PUBLIC_APP_URL } from "@/constants";
import { fetchSeasonDetails } from "@/hooks/use-season-details";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { formatMediaTitle, parseAndValidateId } from "@/lib/utils";

const VideoPlayerModal = lazy(() =>
  import("@/components/video-player-modal").then((m) => ({
    default: m.VideoPlayerModal,
  })),
);

export const Route = createFileRoute("/tv/$id/{-$slug}/season/$seasonNumber")({
  loader: ({ params, context }) => {
    const { id, slug, seasonNumber } = params;
    const parsedId = parseAndValidateId(id);
    const parsedSeason = parseAndValidateId(seasonNumber);
    if (!parsedId.success || !parsedSeason.success) {
      throw notFound();
    }
    context.queryClient.prefetchQuery({
      queryKey: queryKeys.tmdb.tvDetails(Number(id)),
      queryFn: () => getTvDetails({ id: parsedId.data }),
    });
    const data = context.queryClient.getQueryData<Tv>(
      queryKeys.tmdb.tvDetails(Number(id)),
    );
    const title = formatMediaTitle.decode(slug ?? "");
    return {
      id,
      slug,
      title,
      seasonNumber: parsedSeason.data,
      posterPath: data?.poster_path ?? null,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      ...MetaImageTagsGenerator({
        title: loaderData?.title
          ? `${loaderData.title} - Season ${loaderData.seasonNumber} | Pebbly`
          : "Page Not Found | Pebbly",
        description: loaderData?.title
          ? `All episodes of ${loaderData.title} Season ${loaderData.seasonNumber}.`
          : "Explore all episodes of your favorite shows on Pebbly.",
        ogImage: loaderData?.posterPath
          ? `${IMAGE_PREFIX.SD_POSTER}${loaderData.posterPath}`
          : undefined,
        url:
          loaderData?.id &&
          loaderData.title &&
          `${VITE_PUBLIC_APP_URL}/tv/${loaderData.id}/${loaderData.slug}/season/${loaderData.seasonNumber}`,
      }),
    ],
  }),
  component: TvSeasonDetailPage,
});

function TvSeasonDetailPage() {
  const { id, slug, seasonNumber } = Route.useLoaderData();
  const tvId = parseInt(id, 10);

  const { data: tvData, isLoading: tvLoading } = useQuery({
    queryKey: queryKeys.tmdb.tvDetails(tvId),
    queryFn: async () => await getTvDetails({ id: tvId }),
    enabled: !!tvId,
  });

  const { data: seasonData, isLoading: seasonLoading } = useQuery({
    queryKey: queryKeys.tmdb.seasonDetails(tvId, seasonNumber),
    queryFn: () => fetchSeasonDetails(tvId, seasonNumber),
    enabled: !!tvId,
  });

  useCanonicalSlugRedirect({
    entity: "tv",
    subPageEntity: `season/${seasonNumber}`,
    id: tvData?.id,
    title: tvData?.name ?? tvData?.name,
    incomingPathname: `/tv/${id}/${slug}/season/${seasonNumber}`,
    isLoading: tvLoading,
  });

  if (tvLoading || seasonLoading) {
    return <DefaultLoader />;
  }

  if (!tvData || !seasonData) {
    return <DefaultNotFoundComponent />;
  }

  const episodes = seasonData.episodes ?? [];
  const seasons = tvData.seasons?.slice() ?? [];
  const showName = tvData.name ?? tvData.original_name;
  const urltitle = formatMediaTitle.encode(showName);

  return (
    <section className="mx-auto block min-h-[90vh] max-w-screen-xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between gap-3">
          <GoBack link={`/tv/${id}/${slug}/seasons`} title="All Seasons" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {showName} · {seasonData.name}
        </h1>
        {seasonData.overview && (
          <p className="text-muted-foreground max-w-3xl text-sm md:text-base">
            {seasonData.overview}
          </p>
        )}
      </div>

      <div className="scrollbar-hidden mb-6 flex gap-2 overflow-x-auto pb-2">
        {seasons.map((s) => (
          <Link
            key={s.id}
            // @ts-expect-error - correct link
            to={`/tv/${id}/${urltitle}/season/${s.season_number}`}
            className={`pressable-small rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-150 ${
              s.season_number === seasonNumber
                ? "bg-foreground text-background"
                : "bg-secondary/50 text-foreground hover:bg-secondary"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-4 pb-32">
        {episodes.map((episode, index) => (
          <div
            key={episode.id}
            className="group border-default bg-secondary/10 hover:border-foreground/20 hover:bg-secondary/20 hover: relative overflow-hidden rounded-2xl border-2 transition-[color,background-color,border-color,box-shadow] duration-150"
          >
            <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-start md:p-4">
              <div className="relative shrink-0">
                <Image
                  alt={episode.name}
                  className="bg-foreground/10 h-36 w-full rounded-xl object-cover sm:h-28 sm:w-48 md:h-32 md:w-56"
                  height={180}
                  src={
                    episode.still_path
                      ? // Episode stills render at ~224px wide, so w300 (LQ) is plenty;
                        // w780 decodes to ~1.4 MB per still across a whole season.
                        `${IMAGE_PREFIX.LQ_BACKDROP}${episode.still_path}`
                      : `https://placehold.co/500x281?text=No+Image`
                  }
                  width={320}
                  priority={index === 0}
                />
                <Suspense fallback={null}>
                  <VideoPlayerModal
                    tmdbId={tvId}
                    type="tv"
                    title={`${showName} - ${episode.name}`}
                    season={seasonNumber}
                    episode={episode.episode_number}
                    variant="card"
                  />
                </Suspense>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium uppercase">
                      Episode {episode.episode_number}
                    </span>
                    <h3 className="line-clamp-1 text-lg font-bold md:text-xl">
                      {episode.name}
                    </h3>
                  </div>
                  <Suspense fallback={null}>
                    <VideoPlayerModal
                      tmdbId={tvId}
                      type="tv"
                      title={`${showName} - ${episode.name}`}
                      season={seasonNumber}
                      episode={episode.episode_number}
                      variant="episode"
                    />
                  </Suspense>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {episode.vote_average > 0 && (
                    <Badge
                      className="rounded-lg px-2 text-xs font-light"
                      variant="secondary"
                    >
                      <span className="flex items-center gap-1">
                        <Star
                          className="size-3 fill-current text-yellow-400"
                          size={12}
                        />
                        {episode.vote_average.toFixed(1)}
                      </span>
                    </Badge>
                  )}
                  {episode.air_date && (
                    <span className="text-muted-foreground text-xs">
                      {new Date(episode.air_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {episode.runtime && (
                    <>
                      <span className="text-muted-foreground text-xs">•</span>
                      <span className="text-muted-foreground text-xs">
                        {episode.runtime} min
                      </span>
                    </>
                  )}
                </div>

                <p className="text-muted-foreground line-clamp-2 text-sm md:line-clamp-3">
                  {episode.overview || "No overview available."}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
