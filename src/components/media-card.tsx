import { memo } from "react";
import { Link } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import { AutoScrollTitle } from "@/components/ui/auto-scroll-title";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/lib/notifications";
import { useRepository } from "@/lib/repository/use-repository";
import { cn, formatMediaTitle } from "@/lib/utils";

interface BaseCardProps {
  id: number;
  className?: string;
}

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
  hideWatchlistButton?: boolean;
  isRecommended?: boolean;
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
  imageUrl: string;
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
    children,
    hideWatchlistButton,
    isRecommended,
  } = props;

  const { removeFromContinueWatching } = useRemoveFromContinueWatching();
  const { setProgressStatus } = useRepository();

  return (
    <div className={cn("group relative", containerClassName)}>
      <Link
        // @ts-expect-error - correct link
        to={`/${media_type}/${id}/${formattedTitle}`}
        // biome-ignore lint/suspicious/noExplicitAny: dynamic route workaround
        search={(isContinueWatching ? { play: true } : undefined) as any}
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
            className="h-full w-full object-cover transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:scale-[1.03]"
            width={imageWidth}
            height={imageHeight}
            priority={priority}
            sizes={imageSizes}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/0 to-black/0" />
          <div className="absolute inset-0 bg-linear-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100" />

          {isRecommended && (
            <Badge className="absolute top-2 left-2 rounded-md border-0 bg-blue-600/90 px-2 py-1 text-[10px] font-medium text-white">
              Recommended
            </Badge>
          )}

          {rating > 0 && (
            <Badge className="text-meta absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md border-0 bg-black/90 px-2 py-2.75 text-white sm:bg-black/60">
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-white">
                {rating.toFixed(1)}
              </span>
            </Badge>
          )}

          <Badge className="text-meta absolute right-2 bottom-2 rounded-md border-0 bg-black/90 px-2 py-2.75 text-white sm:bg-black/60">
            {mediaTypeLabel}
          </Badge>
        </div>

        {children}
      </Link>

      <div
        className={cn(
          "absolute top-2 right-2 z-10 flex items-center gap-1.5",
          actionsClassName,
        )}
      >
        {isContinueWatching && (
          <button
            type="button"
            title="Remove from Continue Watching"
            aria-label="Remove from Continue Watching"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeFromContinueWatching(id, media_type);
              toast({
                title: "Removed from Continue Watching",
                description: title,
                action: {
                  label: "Undo",
                  onClick: () => {
                    setProgressStatus(
                      String(id),
                      media_type,
                      "watching",
                      {
                        title,
                        image: poster_path ?? props.image ?? "",
                        rating,
                        release_date: release_date ?? "",
                        overview,
                      },
                      "watch-later",
                    );
                  },
                },
              });
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white/80 transition-[color,background-color,transform] duration-150 hover:bg-red-600 hover:text-white [@media(hover:hover)]:hover:scale-105"
          >
            <XIcon className="size-4" />
          </button>
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
            className="h-8 w-8 rounded-md shadow-none hover:scale-105"
          />
        )}
      </div>
    </div>
  );
});
const HorizontalCard = memo((props: MediaCardSpecificProps) => {
  const { title, image, media_type, release_date, relevanceScore } = props;

  const formattedTitle = formatMediaTitle.encode(title);
  // Use LQ (w342) as `src` fallback so the initial download on 1x phones
  // is ~18 KiB not 28 KiB (w500). `srcSet` still offers w500/w780 for 2x+
  // via `tmdbSrcSet`, so high-DPR screens pick the larger candidate without
  // penalising 1x. Saves ~10 KiB per poster, 14 KiB reported by Pagespeed
  // "Improve image delivery" for Mutiny (w300 28.8 KiB → w185 15 KiB).
  const imageUrl = `${IMAGE_PREFIX.LQ_POSTER}${image}`;
  const blurSrc = image ? `${IMAGE_PREFIX.PREVIEW}${image}` : undefined;
  const year = release_date ? new Date(release_date).getFullYear() : "";

  return (
    <BaseMediaCard
      {...props}
      imageUrl={imageUrl}
      blurSrc={blurSrc}
      formattedTitle={formattedTitle}
      containerClassName="w-40 md:w-44 lg:w-48 scroll-snap-item"
      imageContainerClassName="aspect-[2/3]"
      imageWidth={300}
      imageHeight={450}
      imageSizes="(max-width: 640px) 160px, (max-width: 768px) 176px, 192px"
      mediaTypeLabel={media_type === "movie" ? "Movie" : "TV"}
      linkClassName="block h-full w-full outline-hidden ring-offset-background transition-[transform,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pressable"
      actionsClassName="transition-[transform,opacity] duration-200 ease-out"
    >
      <div className="mt-2.5 flex flex-col gap-0.5 overflow-hidden">
        <AutoScrollTitle
          text={title}
          className="text-foreground group-hover:text-primary text-sm leading-tight font-bold tracking-tight transition-colors duration-200"
        />
        <div className="flex min-h-4 items-center gap-1.5">
          {year && (
            <span className="text-meta text-muted-foreground/70">{year}</span>
          )}
          {year && relevanceScore && (
            <span className="text-muted-foreground/30">•</span>
          )}
          {relevanceScore && (
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                relevanceScore >= 80
                  ? "text-emerald-600 dark:text-emerald-400"
                  : relevanceScore >= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {relevanceScore}% Match
            </span>
          )}
        </div>
      </div>
    </BaseMediaCard>
  );
});

const VerticalCard = memo((props: MediaCardSpecificProps) => {
  const { title, image, id, media_type, release_date, isContinueWatching } =
    props;

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
  const { data: seasonDetails } = useSeasonDetails(
    id,
    isTVContinueWatching ? season : undefined,
  );

  const episodeDetail = seasonDetails?.episodes?.find(
    (ep) => ep.episode_number === episode,
  );
  let imageUrl = `${IMAGE_PREFIX.LQ_BACKDROP}${image}`;
  let blurSrc = image ? `${IMAGE_PREFIX.PREVIEW}${image}` : undefined;
  if (isTVContinueWatching) {
    if (episodeDetail?.still_path) {
      imageUrl = `${IMAGE_PREFIX.LQ_BACKDROP}${episodeDetail.still_path}`;
      blurSrc = `${IMAGE_PREFIX.PREVIEW}${episodeDetail.still_path}`;
    } else if (seasonDetails?.poster_path) {
      imageUrl = `${IMAGE_PREFIX.LQ_POSTER}${seasonDetails.poster_path}`;
      blurSrc = `${IMAGE_PREFIX.PREVIEW}${seasonDetails.poster_path}`;
    }
  }
  return (
    <BaseMediaCard
      {...props}
      imageUrl={imageUrl}
      blurSrc={blurSrc}
      formattedTitle={formattedTitle}
      containerClassName="w-64 md:w-72 lg:w-80 scroll-snap-item"
      imageContainerClassName="aspect-video"
      imageWidth={450}
      imageHeight={300}
      imageSizes="(max-width: 640px) 256px, (max-width: 768px) 288px, 320px"
      mediaTypeLabel={media_type === "movie" ? "Movie" : "TV Series"}
      linkClassName="block h-full w-full outline-hidden ring-offset-background transition-[transform,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pressable"
      actionsClassName="transition-[color,background-color,transform] duration-300 ease-out"
    >
      <div className="mt-2.5 flex flex-col gap-1 overflow-hidden">
        {isTVContinueWatching && season && episode && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-meta font-bold text-blue-500 dark:text-blue-400">
              S{season} E{episode}
            </span>
            {episodeDetail?.name && (
              <>
                <span className="text-muted-foreground/50 text-[10px]">•</span>
                <span className="text-muted-foreground/80 max-w-37.5 truncate text-xs font-medium">
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
          <span className="text-meta text-muted-foreground/70 capitalize">
            {year}
          </span>
        )}
      </div>
    </BaseMediaCard>
  );
});
const PersonCard = memo((props: PersonCardSpecificProps) => {
  const { id, name, profile_path, known_for_department, priority } = props;
  const imageUrl = `${IMAGE_PREFIX.SD_PROFILE}${profile_path}`;
  const blurSrc = profile_path
    ? `${IMAGE_PREFIX.PREVIEW}${profile_path}`
    : undefined;

  return (
    <Link
      to="/person/$id"
      params={{ id: String(id) }}
      className="group ring-offset-background focus-visible:ring-ring pressable relative block w-24 outline-hidden transition-[transform,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 md:w-28 lg:w-32"
    >
      <div className="bg-muted border-border group-hover:border-foreground/25 relative aspect-2/3 w-full overflow-hidden rounded-lg border transition-[border-color] duration-200">
        <Image
          alt={name}
          src={imageUrl}
          blurSrc={blurSrc}
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
        <span className="text-meta text-muted-foreground/70 w-full truncate">
          {known_for_department}
        </span>
      </div>
    </Link>
  );
});

const MediaCardSkeleton = (props: MediaCardSkeletonProps) => {
  if (props.card_type === "horizontal") {
    return (
      <div className="w-40 md:w-44 lg:w-48">
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl">
          <Skeleton className="absolute inset-0 rounded-xl" />
          <div className="absolute bottom-2 left-2">
            <Skeleton className="h-4.5 w-12 rounded-md" />
          </div>
          <div className="absolute right-2 bottom-2">
            <Skeleton className="h-4.5 w-10 rounded-md" />
          </div>
        </div>
        <div className="mt-2.5 flex flex-col gap-1">
          <Skeleton className="h-3.5 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
        </div>
      </div>
    );
  }
  if (props.card_type === "vertical") {
    return (
      <div className="w-64 md:w-72 lg:w-80">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          <Skeleton className="absolute inset-0 rounded-xl" />
          <div className="absolute bottom-2 left-2">
            <Skeleton className="h-4.5 w-12 rounded-md" />
          </div>
          <div className="absolute right-2 bottom-2">
            <Skeleton className="h-4.5 w-14 rounded-md" />
          </div>
        </div>
        <div className="mt-2.5 flex flex-col gap-1">
          <Skeleton className="h-3.5 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-24 md:w-28 lg:w-32">
      <Skeleton className="aspect-2/3 w-full rounded-xl" />
      <div className="mt-2 flex flex-col items-start gap-1">
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3 w-3/4 rounded-md" />
      </div>
    </div>
  );
};

export { MediaCard, MediaCardSkeleton };
