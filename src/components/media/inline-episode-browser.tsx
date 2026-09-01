import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { SeasonInfo, TvEpisodeDetail } from "@/lib/tmdb-schemas";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_PREFIX } from "@/constants";
import { fetchSeasonDetails } from "@/hooks/use-season-details";
import {
  useEpisodeProgress,
  useEpisodeWatched,
} from "@/hooks/watch-progress/use-watch-progress";
import { queryKeys } from "@/lib/query/keys";

const VideoPlayerModal = lazy(() =>
  import("@/components/video-player-modal").then((m) => ({
    default: m.VideoPlayerModal,
  })),
);

interface InlineEpisodeBrowserProps {
  tvId: number;
  showName: string;
  seasons: SeasonInfo[];
  image?: string;
  release_date?: string;
  overview?: string;
  rating?: number;
  status?: string;
}

export function InlineEpisodeBrowser({
  tvId,
  showName,
  seasons,
  image,
  release_date,
  overview,
  rating,
  status,
}: InlineEpisodeBrowserProps) {
  const mainSeasons = seasons.filter((s) => s.season_number > 0);
  const specialSeasons = seasons.filter((s) => s.season_number === 0);
  const allSeasons = [...mainSeasons, ...specialSeasons];

  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const displayedSeasons = showAllSeasons ? allSeasons : allSeasons.slice(0, 3);
  const hasMoreSeasons = allSeasons.length > 3;

  const totalEpisodes = seasons.reduce((acc, s) => acc + s.episode_count, 0);
  const episodeTracker = useEpisodeWatched(tvId, totalEpisodes, {
    title: showName,
    image,
    release_date,
    overview,
    rating,
    status,
  });

  const handleSeasonToggle = (
    s: SeasonInfo,
    seenAll: boolean,
    epNums: number[],
  ) => {
    if (seenAll) {
      episodeTracker.unmarkSeasonWatched(s.season_number, epNums);
    } else {
      episodeTracker.markSeasonWatched(s.season_number, epNums);
    }
  };

  return (
    <div className="animate-fade-in-up pb-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          Episodes
        </h2>
      </div>

      <Accordion className="w-full space-y-2">
        {displayedSeasons.map((s) => {
          const seenAll = episodeTracker.isSeasonFullyWatched(
            s.season_number,
            s.episode_count,
          );
          const watchedCount = episodeTracker.getSeasonWatchedCount(
            s.season_number,
            s.episode_count,
          );

          return (
            <AccordionItem
              key={s.id}
              value={`season-${s.season_number}`}
              className="border-default/40 bg-card mb-3 overflow-hidden rounded-xl border"
            >
              <AccordionTrigger className="hover:bg-secondary/10 [&[data-panel-open]]:bg-secondary/10 px-4 py-3.5 text-sm font-semibold transition-colors hover:no-underline">
                <div className="flex flex-1 items-center justify-between pr-2">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold">
                      {`Season ${s.season_number}`}
                    </span>
                    <Badge
                      variant="secondary"
                      className="rounded-md px-1.5 py-0.5 text-[10px]"
                    >
                      {s.episode_count} ep{s.episode_count !== 1 ? "s" : ""}
                    </Badge>
                    {s.air_date && (
                      <span className="text-muted-foreground text-[10px] font-medium">
                        {new Date(s.air_date).getFullYear()}
                      </span>
                    )}
                    {seenAll && (
                      <Badge
                        variant="default"
                        className="rounded-md border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400"
                      >
                        Seen
                      </Badge>
                    )}
                    {!seenAll && watchedCount > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        {watchedCount}/{s.episode_count} watched
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionPanel className="border-default/50 border-t px-0 pb-0">
                <div className="flex h-full items-end justify-end p-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const epNums = Array.from(
                        { length: s.episode_count },
                        (_, i) => i + 1,
                      );
                      handleSeasonToggle(s, seenAll, epNums);
                    }}
                    className="pressable-small text-muted-foreground hover:text-foreground relative z-10 h-7 text-[11px] font-medium transition-colors hover:no-underline"
                  >
                    {seenAll ? "Unmark all as watched" : "Mark all as watched"}
                  </Button>
                </div>

                <SeasonEpisodeList
                  tvId={tvId}
                  showName={showName}
                  seasonNumber={s.season_number}
                  episodeTracker={episodeTracker}
                />
              </AccordionPanel>
            </AccordionItem>
          );
        })}
        <AccordionItem value="" className="sr-only"></AccordionItem>
      </Accordion>

      {!showAllSeasons && hasMoreSeasons && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAllSeasons(true)}
          className="text-muted-foreground hover:bg-secondary/5 hover:text-foreground mt-3 h-auto w-full rounded-xl border-dashed py-3 text-xs font-medium transition-[color,background-color,border-color,box-shadow]"
        >
          {`View all ${allSeasons.length} seasons`}
        </Button>
      )}
    </div>
  );
}

function SeasonEpisodeList({
  tvId,
  showName,
  seasonNumber,
  episodeTracker,
}: {
  tvId: number;
  showName: string;
  seasonNumber: number;
  episodeTracker: ReturnType<typeof useEpisodeWatched>;
}) {
  const { data: seasonData, isLoading } = useQuery({
    queryKey: queryKeys.tmdb.seasonDetails(tvId, seasonNumber),
    queryFn: () => fetchSeasonDetails(tvId, seasonNumber),
    enabled: !!tvId && seasonNumber >= 0,
  });

  const episodes = seasonData?.episodes ?? [];

  if (isLoading) {
    return (
      <div className="divide-border/50 flex flex-col gap-0 divide-y">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
            key={`ep-skel-${i}`}
            className="flex gap-3 px-4 py-3"
          >
            <Skeleton className="xs:h-20 xs:w-32 h-16 w-28 shrink-0 rounded-lg sm:h-24 sm:w-40 md:h-28 md:w-48" />
            <div className="flex flex-1 flex-col gap-2 py-1">
              <Skeleton className="h-2 w-10" />
              <Skeleton className="h-4 w-32 sm:w-48" />
              <Skeleton className="mt-1 hidden h-3 w-full max-w-[90%] sm:block" />
              <Skeleton className="hidden h-3 w-3/4 sm:block" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No episodes found for this season.
      </p>
    );
  }

  return (
    <div className="divide-border/50 flex flex-col divide-y">
      {episodes.map((episode) => (
        <EpisodeCard
          key={episode.id}
          episode={episode}
          showName={showName}
          tvId={tvId}
          seasonNumber={seasonNumber}
          isWatched={episodeTracker.isEpisodeWatched(
            seasonNumber,
            episode.episode_number,
          )}
          onToggleWatched={() => {
            episodeTracker.toggleEpisodeWatched(
              seasonNumber,
              episode.episode_number,
            );
          }}
        />
      ))}
    </div>
  );
}

function EpisodeCard({
  episode,
  showName,
  tvId,
  seasonNumber,
  isWatched,
  onToggleWatched,
}: {
  episode: TvEpisodeDetail;
  showName: string;
  tvId: number;
  seasonNumber: number;
  isWatched: boolean;
  onToggleWatched: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLongOverview = (episode.overview?.length ?? 0) > 100;
  const progress = useEpisodeProgress(
    tvId,
    seasonNumber,
    episode.episode_number,
  );

  return (
    <div className="group hover:bg-secondary/5 relative flex flex-row items-start gap-3 px-4 py-3 transition-colors duration-200">
      <div className="relative shrink-0 overflow-hidden rounded-lg">
        <Image
          alt={episode.name}
          className="bg-foreground/10 xs:h-20 xs:w-32 h-16 w-28 rounded-lg object-cover sm:h-24 sm:w-40 md:h-28 md:w-48"
          height={140}
          src={
            episode.still_path
              ? `${IMAGE_PREFIX.LQ_BACKDROP}${episode.still_path}`
              : "https://placehold.co/500x281?text=No+Image"
          }
          width={250}
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

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted-foreground text-[10px] font-medium">
              E{String(episode.episode_number).padStart(2, "0")}
            </span>
            <h3 className="truncate text-sm font-bold md:text-base">
              {episode.name}
            </h3>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={onToggleWatched}
            className={`pressable-small h-auto shrink-0 rounded-lg border p-1.5 text-[10px] font-medium transition-[color,background-color,border-color] ${
              isWatched
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-border/50 text-muted-foreground hover:border-foreground/20 hover:text-foreground bg-transparent"
            }`}
            title={isWatched ? "Mark as unwatched" : "Mark as watched"}
          >
            {isWatched ? (
              <svg
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <title>Mark as unwatched</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            ) : (
              <svg
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <title>Mark as watched</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isWatched && (
            <Badge
              variant="default"
              className="rounded-md border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400"
            >
              Seen
            </Badge>
          )}
          {!isWatched && progress > 0 && (
            <Badge
              variant="secondary"
              className="rounded-md border border-amber-500/25 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500 dark:text-amber-400"
            >
              {Math.round(progress)}%
            </Badge>
          )}
          {episode.vote_average > 0 && (
            <Badge
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
              variant="secondary"
            >
              <Star className="mr-0.5 size-2.5 fill-current text-yellow-400" />
              {episode.vote_average.toFixed(1)}
            </Badge>
          )}
          {episode.air_date && (
            <span className="text-muted-foreground text-[10px] font-medium">
              {new Date(episode.air_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          {episode.runtime && (
            <span className="text-muted-foreground text-[10px] font-medium">
              {episode.runtime}m
            </span>
          )}
        </div>

        {episode.overview ? (
          <div className="mt-0.5 hidden sm:block">
            <p className="text-muted-foreground text-xs leading-relaxed">
              {expanded || !hasLongOverview
                ? episode.overview
                : `${episode.overview.slice(0, 120)}…`}
            </p>
            {hasLongOverview && (
              <Button
                type="button"
                variant="link"
                onClick={() => setExpanded(!expanded)}
                className="text-foreground/60 hover:text-foreground mt-0.5 h-auto p-0 text-[11px] font-medium transition-colors"
              >
                {expanded ? "Show less" : "Read more"}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground/60 text-xs italic">
            No overview available.
          </p>
        )}
      </div>
    </div>
  );
}
