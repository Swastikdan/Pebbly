import { useEffect, useMemo } from "react";

import type { MediaType } from "@/domain/media";
import type { ProgressStatus, ReactionStatus } from "@/domain/watchlist";
import { GoBack } from "@/components/go-back";
import { RatingCount } from "@/components/media/rating-count";
import { WatchlistStatusMenu } from "@/components/media/watchlist-status-menu";
import { ShareButton } from "@/components/share-button";
import {
  useMediaState,
  useToggleWatchlistItem,
  useWatchlistItem,
} from "@/hooks/use-watchlist";
import { useRepository } from "@/lib/repository/use-repository";
import { logError } from "@/lib/utils";

export const MediaTitleContainer = (props: {
  title: string;
  rating: number;
  image: string;
  poster_path?: string | null;
  backdrop_path?: string;
  id: number;
  media_type: MediaType;
  release_date: string | null;
  description: string;
  tagline: string | null;
  releaseyear: string;
  uscertification: string;
  runtime?: string | null;
  vote_average: number | null;
  vote_count: number | null;
  imdb_url?: string | null;
  tv_status?: string | null;
}) => {
  const {
    id,
    title,
    rating,
    poster_path,
    media_type,
    release_date,
    tagline,
    releaseyear,
    uscertification,
    runtime,
    vote_average,
    vote_count,
    imdb_url,
    tv_status,
  } = props;

  const mediaState = useMediaState(String(id), media_type);
  const { setProgressStatus, setReaction } = useRepository();
  const toggleWatchlist = useToggleWatchlistItem();
  const { isOnWatchList } = useWatchlistItem(String(id), media_type);
  const progressStatus = mediaState?.progressStatus ?? null;
  const reaction = mediaState?.reaction ?? null;

  const metadata = useMemo(
    () => ({
      title,
      image: poster_path ?? props.image ?? undefined,
      backdrop: props.backdrop_path,
      rating,
      release_date: release_date ?? "",
      overview: props.description,
    }),
    [
      title,
      poster_path,
      props.backdrop_path,
      rating,
      release_date,
      props.description,
      props.image,
    ],
  );

  useEffect(() => {
    if (
      mediaState &&
      (!mediaState.title || mediaState.title === "Unknown Title") &&
      title &&
      title !== "Unknown Title"
    ) {
      if (progressStatus) {
        setProgressStatus({
          id: String(id),
          mediaType: media_type,
          progressStatus,
          metadata,
        });
      }
    }
  }, [
    mediaState,
    title,
    id,
    media_type,
    progressStatus,
    setProgressStatus,
    metadata,
  ]);

  const handleAdd = () => {
    toggleWatchlist(
      {
        ...metadata,
        id: String(id),
        media_type,
      },
      false,
    ).catch((error) => logError("toggle watchlist", error));
  };

  const handleStatusChange = (status: ProgressStatus) => {
    setProgressStatus({
      id: String(id),
      mediaType: media_type,
      progressStatus: status,
      metadata,
      currentStatus: progressStatus,
    });
  };

  const handleReactionChange = (r: ReactionStatus | null) => {
    setReaction({
      id: String(id),
      mediaType: media_type,
      reaction: r,
      metadata,
    });
  };

  const handleRemove = () => {
    toggleWatchlist(
      {
        ...metadata,
        id: String(id),
        media_type,
      },
      true,
    ).catch((error) => logError("toggle watchlist", error));
  };

  return (
    <div className="animate-fade-in pt-5 pb-4">
      <div className="space-y-3 pb-4">
        <div className="flex items-center justify-between gap-3">
          <GoBack title="Back" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="hidden min-h-9 min-w-35 items-center justify-end sm:flex">
              <WatchlistStatusMenu
                isOnWatchlist={isOnWatchList}
                progressStatus={progressStatus}
                reaction={reaction}
                mediaType={media_type}
                tmdbId={id}
                onAdd={handleAdd}
                onStatusChange={handleStatusChange}
                onReactionChange={handleReactionChange}
                onRemove={handleRemove}
                metadata={metadata}
              />
            </div>
            <ShareButton title={title} />
          </div>
        </div>
        <div className="flex min-h-9 justify-end sm:hidden">
          <WatchlistStatusMenu
            isOnWatchlist={isOnWatchList}
            progressStatus={progressStatus}
            reaction={reaction}
            mediaType={media_type}
            tmdbId={id}
            onAdd={handleAdd}
            onStatusChange={handleStatusChange}
            onReactionChange={handleReactionChange}
            onRemove={handleRemove}
            metadata={metadata}
          />
        </div>
        <h1 className="text-h1 lg:px-0">
          {imdb_url ? (
            <a
              className="transition-opacity hover:opacity-70"
              href={imdb_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {title}
            </a>
          ) : (
            title
          )}
        </h1>
        {tagline && (
          <h2 className="text-compact text-muted-foreground/80 hidden italic sm:flex">
            {tagline}
          </h2>
        )}
      </div>
      <div className="flex flex-row items-center justify-between">
        <span className="text-meta text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
          {releaseyear && releaseyear !== "null" && (
            <>
              <span>{releaseyear}</span>
              <span className="text-border">·</span>
            </>
          )}

          <span className="border-border/80 text-label text-foreground rounded-md border px-1.5 py-0.5">
            {uscertification}
          </span>
          {runtime && (
            <>
              <span className="text-border">·</span>
              <span>{runtime}</span>
            </>
          )}
          {tv_status && (
            <>
              <span className="text-border">·</span>
              <span>{tv_status}</span>
            </>
          )}
        </span>

        <div className="flex items-center gap-2">
          {vote_average != null && (
            <span className="text-meta text-muted-foreground font-medium whitespace-nowrap">
              User Score
            </span>
          )}
          <RatingCount
            rating={parseFloat(vote_average?.toFixed(1) ?? "0")}
            ratingcount={vote_count ?? 0}
          />
        </div>
      </div>
    </div>
  );
};
