import { ArrowDown, ArrowUp } from "lucide-react";

import type { ProgressStatus, ReactionStatus } from "@/domain/watchlist";
import type { MediaType } from "@/lib/media-types";
import { Button } from "@/components/ui/button";
import { TrashBin } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import {
  MediaChip,
  MediaMetaRow,
  MediaRowCardShell,
  releaseYearOf,
  resolvePosterSrc,
} from "@/components/watchlist/media-row-card-shell";
import { getProgressOption, getReactionOption } from "@/constants/watchlist";
import { toast } from "@/hooks/use-toast-store";
import { useRepository } from "@/lib/repository/use-repository";
import { cn, formatMediaTitle } from "@/lib/utils";

export function CustomListMediaCard({
  item,
  listId,
  priority,
  readOnly,
  rank,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  item: {
    tmdbId: number;
    mediaType: MediaType;
    title?: string;
    image?: string;
    backdrop?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
    progressStatus?: ProgressStatus;
    reaction?: ReactionStatus;
  };
  listId: string;
  priority?: boolean;
  readOnly?: boolean;
  rank?: number;
  onMove?: (dir: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const { toggleListItem } = useRepository();
  const hasMetadata = !!(item.title && (item.backdrop || item.image));
  const formattedTitle = item.title
    ? formatMediaTitle.encode(item.title)
    : undefined;
  const imageUrl = resolvePosterSrc(item.image, item.backdrop);
  const year = releaseYearOf(item.release_date);

  const progressStatus = item.progressStatus ?? "watch-later";
  const reaction = item.reaction ?? null;
  const progressOption = getProgressOption(progressStatus);
  const reactionOption = reaction ? getReactionOption(reaction) : null;
  const ProgressIcon = progressOption.icon;

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleListItem({
      listId: listId,
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
    })
      .then((added) => {
        if (added) return;
        toast({
          title: "Removed from collection",
          description: item.title,
          action: {
            label: "Undo",
            onClick: () => {
              toggleListItem({
                listId,
                tmdbId: item.tmdbId,
                mediaType: item.mediaType,
                title: item.title,
                image: item.image,
                backdrop: item.backdrop,
                rating: item.rating,
                release_date: item.release_date,
                overview: item.overview,
              }).catch(console.error);
            },
          },
        });
      })
      .catch(console.error);
  };

  const handleMoveClick = (dir: -1 | 1) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMove?.(dir);
  };

  return (
    <MediaRowCardShell
      to={
        formattedTitle
          ? `/${item.mediaType}/${item.tmdbId}/${formattedTitle}`
          : `/${item.mediaType}/${item.tmdbId}`
      }
      className="rounded-xl"
      poster={
        <>
          {hasMetadata && imageUrl ? (
            <Image
              alt={item.title ?? ""}
              className="bg-muted h-[160px] w-[107px] rounded-xl object-cover sm:h-[140px] sm:w-[93px]"
              height={210}
              src={imageUrl}
              width={140}
              priority={priority}
            />
          ) : (
            <div className="bg-secondary text-muted-foreground flex h-[160px] w-[107px] shrink-0 animate-pulse items-center justify-center rounded-xl text-xs font-semibold uppercase sm:h-[140px] sm:w-[93px]">
              {item.mediaType === "movie" ? "MOV" : "TV"}
            </div>
          )}
          {rank !== undefined && (
            <span className="bg-foreground text-background ring-card absolute -top-1.5 -left-1.5 flex size-6 items-center justify-center rounded-lg text-[11px] font-extrabold tabular-nums shadow-md ring-2">
              {rank}
            </span>
          )}
        </>
      }
      title={
        item.title ??
        `${item.mediaType === "movie" ? "Movie" : "TV Show"} #${item.tmdbId}`
      }
      titleClassName="group-hover:text-primary transition-colors"
      actions={
        !readOnly && (
          <div className="flex shrink-0 items-start gap-0.5">
            {onMove !== undefined && (
              <div className="flex flex-col gap-0">
                <button
                  type="button"
                  onClick={handleMoveClick(-1)}
                  disabled={!canMoveUp}
                  title="Move up one rank"
                  className={cn(
                    "text-muted-foreground/60 flex size-5 items-center justify-center rounded-md transition-colors",
                    canMoveUp
                      ? "hover:bg-secondary hover:text-foreground cursor-pointer"
                      : "cursor-not-allowed opacity-30",
                  )}
                  aria-label="Move up one rank"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={handleMoveClick(1)}
                  disabled={!canMoveDown}
                  title="Move down one rank"
                  className={cn(
                    "text-muted-foreground/60 flex size-5 items-center justify-center rounded-md transition-colors",
                    canMoveDown
                      ? "hover:bg-secondary hover:text-foreground cursor-pointer"
                      : "cursor-not-allowed opacity-30",
                  )}
                  aria-label="Move down one rank"
                >
                  <ArrowDown size={12} />
                </button>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive shrink-0 p-1.5 opacity-100 transition-colors focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
              aria-label={`Remove from collection`}
              onClick={handleRemove}
            >
              <TrashBin size={14} />
            </Button>
          </div>
        )
      }
      metaRow={
        <MediaMetaRow
          mediaType={item.mediaType}
          year={year}
          rating={item.rating}
          className="text-muted-foreground/90 dark:text-muted-foreground/75 text-[11px]"
          labelClassName="font-semibold tracking-wide uppercase"
        />
      }
      overview={item.overview}
      overviewClassName="text-muted-foreground/80 dark:text-muted-foreground/60"
      footer={
        (item.progressStatus || item.reaction) && (
          <div className="flex items-center gap-1.5 pt-2">
            {item.progressStatus && (
              <MediaChip icon={ProgressIcon} label={progressOption.label} />
            )}
            {reactionOption && (
              <MediaChip
                icon={reactionOption.icon}
                label={reactionOption.label}
                title={reactionOption.label}
              />
            )}
          </div>
        )
      }
    />
  );
}
