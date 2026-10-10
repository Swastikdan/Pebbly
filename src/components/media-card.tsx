import { memo, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import { AutoScrollTitle } from "@/components/ui/auto-scroll-title";
import { Badge } from "@/components/ui/badge";
import { ThumbsDown, ThumbsUp } from "@/components/ui/hugeicons";
import { Star, XIcon } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistButton } from "@/components/watchlist-button";
import { IMAGE_PREFIX } from "@/constants";
import { useSeasonDetails } from "@/hooks/use-season-details";
import {
  useRemoveFromContinueWatching,
  useWatchProgress,
} from "@/hooks/watch-progress/use-watch-progress";
import { destructiveToast } from "@/lib/notifications";
import { mediaDetailRoute } from "@/lib/route-helpers";
import { tmdbImageUrl } from "@/lib/tmdb-image";
import { cn, formatMediaTitle } from "@/lib/utils";

interface BaseCardProps {
  id: number;
  className?: string;
}

interface ContinueWatchingRemoveButtonProps {
  id: number;
  mediaType: MediaType;
  title: string;
  image: string;
  rating: number;
  releaseDate: string | null;
  overview?: string;
  onOptimisticRemove?: () => void;
  onRestore?: () => void;
}

const ContinueWatchingRemoveButton = memo(
  (props: ContinueWatchingRemoveButtonProps) => {
    const { id, mediaType, title, onOptimisticRemove, onRestore } = props;
    const { removeFromContinueWatching } = useRemoveFromContinueWatching();

    return (
      <button
        type="button"
        title="Remove from Continue Watching"
        aria-label="Remove from Continue Watching"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOptimisticRemove?.();
          destructiveToast({
            title: "Removed from Continue Watching",
            description: title,
            timeout: 5000,
            onUndo: () => {
              onRestore?.();
            },
            onConfirm: () => {
              void removeFromContinueWatching(id, mediaType);
            },
          });
        }}
        className="hover:bg-destructive flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white/80 transition-[color,background-color] duration-150 hover:text-white"
      >
        <XIcon aria-hidden="true" className="size-4" />
      </button>
    );
  },
);

interface MediaCardSpecificProps extends BaseCardProps {
  card_type: "horizontal" | "vertical";
  title: string;
  rating: number;
  image?: string;
  poster_path?: string | null;
  media_type: MediaType;
  release_date: string | null;
  known_for_department?: string;
  is_on_watchlist_page?: boolean;
  is_on_homepage?: boolean;
  isContinueWatching?: boolean;
  overview?: string;
  priority?: boolean;
  relevanceScore?: number;
  reasoning?: string;
  hideWatchlistButton?: boolean;
  isRecommended?: boolean;
  feedbackActions?: {
    onMoreLikeThis: () => void;
    onNotThis: (options?: { onRestore?: () => void }) => void;
    isLiked?: boolean;
    isDisliked?: boolean;
  };
}

interface PersonCardSpecificProps extends BaseCardProps {
  card_type: "person";
  name: string;
  profile_path: string;
  known_for_department: string;
  priority?: boolean;
}

export type CardProps = MediaCardSpecificProps | PersonCardSpecificProps;

export interface MediaCardSkeletonProps {
  card_type?: "horizontal" | "vertical" | "person";
  className?: string;
}

const MediaCard = memo((props: CardProps) => {
  if (props.card_type === "horizontal") {
    return <HorizontalCard {...props} />;
  }
  if (props.card_type === "vertical") {
    return <VerticalCard {...props} />;
  }
  if (props.card_type === "person") {
    return <PersonCard {...props} />;
  }
});
interface BaseMediaCardProps extends MediaCardSpecificProps {
  imageUrl?: string;
  blurSrc?: string;
  formattedTitle: string;
  containerClassName: string;
  imageContainerClassName: string;
  imageWidth: number;
  imageHeight: number;
  imageSizes: string;
  mediaTypeLabel: string;
  actionsClassName: string;
  linkClassName: string;
  /** Whether a continue-watching card has a valid episode to resume. */
  continueWatchingPlay?: boolean;
  children: React.ReactNode;
}

const BaseMediaCard = memo((props: BaseMediaCardProps) => {
  const {
    id,
    title,
    rating,
    media_type,
    poster_path,
    release_date,
    is_on_homepage,
    is_on_watchlist_page,
    isContinueWatching,
    overview,
    priority,
    imageUrl,
    blurSrc,
    formattedTitle,
    containerClassName,
    imageContainerClassName,
    imageWidth,
    imageHeight,
    imageSizes,
    mediaTypeLabel,
    actionsClassName,
    linkClassName,
    continueWatchingPlay = true,
    children,
    hideWatchlistButton,
    isRecommended,
    feedbackActions,
  } = props;

  const destination = mediaDetailRoute({
    mediaType: media_type,
    id,
    slug: formattedTitle || undefined,
    play: isContinueWatching && continueWatchingPlay,
  });

  const [removed, setRemoved] = useState(false);
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);

  useEffect(() => {
    void feedbackActions?.isLiked;
    setOptimisticLiked(null);
  }, [feedbackActions?.isLiked]);

  if (removed) return null;

  const isLiked =
    optimisticLiked !== null
      ? optimisticLiked
      : Boolean(feedbackActions?.isLiked);

  return (
    <div className={cn("group relative", containerClassName)}>
      <Link
        to={destination.to}
        params={destination.params}
        search={destination.search}
        className={linkClassName}
      >
        <div
          data-media-poster
          className={cn(
            "surface-raised interactive-raised bg-muted relative w-full overflow-hidden rounded-lg",
            imageContainerClassName,
          )}
        >
          <Image
            alt={title}
            src={imageUrl}
            blurSrc={blurSrc}
            placeholderText={title}
            className="h-full w-full object-cover transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:scale-[1.03]"
            width={imageWidth}
            height={imageHeight}
            priority={priority}
            sizes={imageSizes}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/0 to-black/0" />
          <div className="absolute inset-0 bg-linear-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100" />

          {isRecommended && (
            <Badge className="absolute start-2 top-2 rounded-md border-0 bg-blue-600/90 px-2 py-1 text-[10px] font-medium text-white">
              Recommended
            </Badge>
          )}

          {rating > 0 && (
            <Badge className="text-meta absolute start-2 bottom-2 flex items-center gap-1.5 rounded-md border-0 bg-black/90 px-2 py-2.75 text-white sm:bg-black/60">
              <Star
                aria-hidden="true"
                className="size-4 fill-amber-400 text-amber-400"
              />
              <span className="font-semibold text-white">
                {rating.toFixed(1)}
              </span>
            </Badge>
          )}

          <Badge className="text-meta absolute end-2 bottom-2 rounded-md border-0 bg-black/90 px-2 py-2.75 text-white sm:bg-black/60">
            {mediaTypeLabel}
          </Badge>
        </div>

        {children}
      </Link>

      <div
        className={cn(
          "absolute end-2 top-2 z-10 flex items-center gap-1.5",
          actionsClassName,
          (isLiked || feedbackActions?.isLiked) && "!opacity-100",
        )}
      >
        {isContinueWatching && (
          <ContinueWatchingRemoveButton
            id={id}
            mediaType={media_type}
            title={title}
            image={poster_path ?? props.image ?? ""}
            rating={rating}
            releaseDate={release_date}
            overview={overview}
            onOptimisticRemove={() => setRemoved(true)}
            onRestore={() => setRemoved(false)}
          />
        )}
        {!hideWatchlistButton && (
          <WatchlistButton
            id={id}
            image={poster_path ?? props.image ?? ""}
            is_on_homepage={is_on_homepage}
            is_on_watchlist_page={is_on_watchlist_page}
            media_type={media_type}
            rating={rating}
            release_date={release_date ?? ""}
            title={title}
            overview={overview}
            className="h-8 w-8 rounded-md shadow-none"
            onOptimisticRemove={
              is_on_watchlist_page ? () => setRemoved(true) : undefined
            }
            onRestore={
              is_on_watchlist_page ? () => setRemoved(false) : undefined
            }
          />
        )}
        {feedbackActions && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={isLiked ? "More like this (saved)" : "More like this"}
              aria-label={`More like this: ${title}`}
              aria-pressed={isLiked}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOptimisticLiked(!isLiked);
                feedbackActions.onMoreLikeThis();
              }}
              className={cn(
                "pressable flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-all duration-150 active:scale-95",
                isLiked
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-neutral-700 bg-black/70 text-white/90 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white",
              )}
            >
              <ThumbsUp
                aria-hidden="true"
                className={cn("size-3.5", isLiked && "fill-current")}
              />
            </button>
            <button
              type="button"
              title="Not for me"
              aria-label={`Not this: ${title}`}
              aria-pressed={feedbackActions.isDisliked}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setRemoved(true);
                feedbackActions.onNotThis({
                  onRestore: () => setRemoved(false),
                });
              }}
              className={cn(
                "pressable hover:border-destructive hover:bg-destructive flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-neutral-700 bg-black/70 text-white/90 transition-all duration-150 hover:text-white active:scale-95",
                feedbackActions.isDisliked &&
                  "border-destructive bg-destructive text-white",
              )}
            >
              <ThumbsDown aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
const HorizontalCard = memo((props: MediaCardSpecificProps) => {
  const { title, image, media_type, release_date, relevanceScore, reasoning } =
    props;

  const formattedTitle = formatMediaTitle.encode(title);
  // Use LQ (w185) as `src` fallback so the initial download on 1x phones
  // is ~12 KiB not 28 KiB (w500). `srcSet` still offers w342/w500 for high-DPR
  // screens via `tmdbSrcSet`. On mobile (159px rendered), sizes 92px/160px
  // routes DPR 1-2 displays to w185 (185x278) instead of downloading w342.
  const imageUrl = tmdbImageUrl(IMAGE_PREFIX.LQ_POSTER, image);
  const blurSrc = tmdbImageUrl(IMAGE_PREFIX.PREVIEW, image);
  const year = release_date ? new Date(release_date).getFullYear() : "";

  return (
    <BaseMediaCard
      {...props}
      imageUrl={imageUrl}
      blurSrc={blurSrc}
      formattedTitle={formattedTitle}
      containerClassName="w-40 md:w-44 lg:w-48"
      imageContainerClassName="aspect-[2/3]"
      imageWidth={192}
      imageHeight={288}
      imageSizes="(max-width: 767px) 92px, (max-width: 1023px) 176px, 192px"
      mediaTypeLabel={media_type === "movie" ? "Movie" : "Series"}
      linkClassName="block h-full w-full outline-hidden ring-offset-background transition-[transform,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pressable"
      actionsClassName="opacity-100 transition-[transform,opacity] duration-200 ease-out [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
    >
      <div className="mt-2.5 flex flex-col gap-0.5 overflow-hidden">
        <AutoScrollTitle
          text={title}
          className="text-foreground group-hover:text-primary text-sm leading-tight font-bold tracking-tight transition-colors duration-200"
        />
        <div className="flex min-h-4 items-center gap-1.5">
          {year && (
            <span className="text-meta text-muted-foreground">{year}</span>
          )}
          {year && relevanceScore && (
            <span className="text-muted-foreground/30">•</span>
          )}
          {relevanceScore && (
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                relevanceScore >= 80
                  ? "text-emerald-700 dark:text-emerald-400"
                  : relevanceScore >= 60
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {relevanceScore}% Match
            </span>
          )}
        </div>
        {reasoning && (
          <p
            className="text-muted-foreground/80 mt-1 line-clamp-2 text-[11px] leading-snug text-pretty"
            title={reasoning}
          >
            {reasoning}
          </p>
        )}
      </div>
    </BaseMediaCard>
  );
});

const VerticalCard = memo((props: MediaCardSpecificProps) => {
  const {
    title,
    image,
    id,
    media_type,
    release_date,
    isContinueWatching,
    reasoning,
  } = props;

  const formattedTitle = formatMediaTitle.encode(title);
  const year = release_date ? new Date(release_date).getFullYear() : "";

  const isTVContinueWatching = isContinueWatching && media_type === "tv";

  const { progress } = useWatchProgress(
    id,
    isTVContinueWatching ? "tv" : "movie",
  );
  const season = progress?.context?.season;
  const episode = progress?.context?.episode;

  // Season details are routed through the shared batcher (see
  // use-season-details.ts) so the N cards in a continue-watching strip
  // coalesce their requests instead of firing N parallel fetches.
  const seasonDetailsQuery = useSeasonDetails(
    id,
    isTVContinueWatching ? season : undefined,
  );
  const seasonDetails = seasonDetailsQuery.data;

  const episodeDetail = seasonDetails?.episodes?.find(
    (ep) => ep.episode_number === episode,
  );
  const seasonDetailsLoaded = seasonDetailsQuery.isFetched;
  const hasValidResumeEpisode =
    !isTVContinueWatching || !seasonDetailsLoaded || Boolean(episodeDetail);
  let imageUrl = tmdbImageUrl(IMAGE_PREFIX.LQ_BACKDROP, image);
  let blurSrc = tmdbImageUrl(IMAGE_PREFIX.PREVIEW, image);
  if (isTVContinueWatching) {
    if (episodeDetail?.still_path) {
      imageUrl = tmdbImageUrl(
        IMAGE_PREFIX.LQ_BACKDROP,
        episodeDetail.still_path,
      );
      blurSrc = tmdbImageUrl(IMAGE_PREFIX.PREVIEW, episodeDetail.still_path);
    } else if (seasonDetails?.poster_path) {
      imageUrl = tmdbImageUrl(
        IMAGE_PREFIX.LQ_POSTER,
        seasonDetails.poster_path,
      );
      blurSrc = tmdbImageUrl(IMAGE_PREFIX.PREVIEW, seasonDetails.poster_path);
    }
  }
  return (
    <BaseMediaCard
      {...props}
      continueWatchingPlay={hasValidResumeEpisode}
      imageUrl={imageUrl}
      blurSrc={blurSrc}
      formattedTitle={formattedTitle}
      containerClassName="w-64 md:w-72 lg:w-80"
      imageContainerClassName="aspect-video"
      imageWidth={450}
      imageHeight={300}
      imageSizes="(max-width: 640px) 256px, (max-width: 768px) 288px, 320px"
      mediaTypeLabel={media_type === "movie" ? "Movie" : "Series"}
      linkClassName="block h-full w-full outline-hidden ring-offset-background transition-[transform,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pressable"
      actionsClassName="transition-[color,background-color,transform] duration-300 ease-out"
    >
      <div className="mt-2.5 flex flex-col gap-1 overflow-hidden">
        {isTVContinueWatching && seasonDetailsLoaded && episodeDetail && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-meta font-bold text-blue-500 dark:text-blue-400">
              S{season} E{episode}
            </span>
            {episodeDetail?.name && (
              <>
                <span className="text-muted-foreground/50 text-[10px]">•</span>
                <span className="text-foreground/75 dark:text-muted-foreground max-w-37.5 truncate text-xs font-medium">
                  {episodeDetail.name}
                </span>
              </>
            )}
          </div>
        )}
        <AutoScrollTitle
          text={title}
          className="text-foreground group-hover:text-primary min-h-5 text-sm leading-tight font-bold tracking-tight transition-colors duration-200"
        />

        {!isTVContinueWatching && (
          <span className="text-meta text-muted-foreground capitalize">
            {year}
          </span>
        )}
        {reasoning && (
          <p
            className="text-muted-foreground/80 mt-0.5 line-clamp-2 text-[11px] leading-snug text-pretty"
            title={reasoning}
          >
            {reasoning}
          </p>
        )}
      </div>
    </BaseMediaCard>
  );
});
const PersonCard = memo((props: PersonCardSpecificProps) => {
  const { id, name, profile_path, known_for_department, priority } = props;
  const imageUrl = tmdbImageUrl(IMAGE_PREFIX.SD_PROFILE, profile_path);
  const blurSrc = tmdbImageUrl(IMAGE_PREFIX.PREVIEW, profile_path);

  return (
    <Link
      to="/person/$id"
      params={{ id: String(id) }}
      className="group ring-offset-background focus-visible:ring-ring pressable relative block w-24 outline-hidden transition-[transform,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 md:w-28 lg:w-32"
    >
      <div className="bg-muted relative aspect-2/3 w-full overflow-hidden rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0/0.06),0px_1px_2px_-1px_oklch(0_0_0/0.06),0px_2px_4px_0px_oklch(0_0_0/0.04)] transition-[box-shadow] duration-150 ease-out group-hover:shadow-[0px_0px_0px_1px_oklch(0_0_0/0.08),0px_1px_2px_-1px_oklch(0_0_0/0.08),0px_2px_4px_0px_oklch(0_0_0/0.06)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.08)] dark:group-hover:shadow-[0_0_0_1px_oklch(1_0_0/0.13)]">
        <Image
          alt={name}
          src={imageUrl}
          blurSrc={blurSrc}
          placeholderText={name}
          className="h-full w-full object-cover transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:scale-[1.03]"
          width={200}
          height={300}
          priority={priority}
          sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
        />
      </div>

      <div className="mt-2 flex flex-col items-start overflow-hidden text-start">
        <AutoScrollTitle
          text={name}
          className="text-foreground group-hover:text-primary w-full truncate text-sm leading-tight font-bold transition-colors duration-200"
        />
        <span className="text-meta text-muted-foreground w-full truncate">
          {known_for_department}
        </span>
      </div>
    </Link>
  );
});

const MediaCardSkeleton = (props: MediaCardSkeletonProps) => {
  if (props.card_type === "horizontal") {
    return (
      <div className={cn("w-40 md:w-44 lg:w-48", props.className)}>
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg">
          <Skeleton className="absolute inset-0 rounded-lg" />
          <div className="absolute end-2 top-2">
            <Skeleton className="size-8 rounded-md" />
          </div>
          <div className="absolute start-2 bottom-2">
            <Skeleton className="h-4.5 w-12 rounded-md" />
          </div>
          <div className="absolute end-2 bottom-2">
            <Skeleton className="h-4.5 w-10 rounded-md" />
          </div>
        </div>
        <div className="mt-2.5 flex flex-col gap-0.5">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
        </div>
      </div>
    );
  }
  if (props.card_type === "vertical") {
    return (
      <div className={cn("w-64 md:w-72 lg:w-80", props.className)}>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <Skeleton className="absolute inset-0 rounded-lg" />
          <div className="absolute end-2 top-2">
            <Skeleton className="size-8 rounded-md" />
          </div>
          <div className="absolute start-2 bottom-2">
            <Skeleton className="h-4.5 w-12 rounded-md" />
          </div>
          <div className="absolute end-2 bottom-2">
            <Skeleton className="h-4.5 w-14 rounded-md" />
          </div>
        </div>
        <div className="mt-2.5 flex flex-col gap-1">
          <Skeleton className="h-4.5 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-24 md:w-28 lg:w-32", props.className)}>
      <Skeleton className="aspect-2/3 w-full rounded-lg" />
      <div className="mt-2 flex flex-col items-start gap-1">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-3 w-3/4 rounded-md" />
      </div>
    </div>
  );
};

export { MediaCard, MediaCardSkeleton };
