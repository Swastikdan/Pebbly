import { useState } from "react";

import type { MediaType } from "@/domain/media";
import type { ProgressStatus, ReactionStatus } from "@/domain/watchlist";
import { ArrowDown, ArrowUp } from "@/components/ui/hugeicons";
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
import { destructiveToast } from "@/lib/notifications";
import { useRepository } from "@/lib/repository/use-repository";
import { cn, formatMediaTitle, logError } from "@/lib/utils";

export function CustomListMediaCard({
  item,
  listId,
  priority,
  readOnly,
  rank,
  onMove,
  canMoveUp,
  canMoveDown,
  selected,
  onSelect,
  showSelect,
  listColor,
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
  selected?: boolean;
  onSelect?: () => void;
  showSelect?: boolean;
  listColor?: string;
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

  const [removed, setRemoved] = useState(false);

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRemoved(true);
    destructiveToast({
      title: "Removed from collection",
      description: item.title,
      timeout: 5000,
      onUndo: () => {
        setRemoved(false);
      },
      onConfirm: () => {
        toggleListItem({
          listId: listId,
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
        }).catch((error) => logError("remove list item", error));
      },
    });
  };

  if (removed) return null;

  const handleMoveClick = (dir: -1 | 1) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMove?.(dir);
  };

  const routeType = item.mediaType === "tv" ? "series" : item.mediaType;

  return (
    <MediaRowCardShell
      to={
        formattedTitle
          ? `/${routeType}/${item.tmdbId}/${formattedTitle}`
          : `/${routeType}/${item.tmdbId}`
      }
      className={cn(
        "rounded-lg",
        selected &&
          (listColor
            ? "text-foreground"
            : "border-primary/20 bg-primary/[0.06] text-foreground"),
      )}
      style={
        selected && listColor
          ? {
              backgroundColor: `${listColor}12`,
              borderColor: `${listColor}55`,
            }
          : undefined
      }
      poster={
        <>
          {hasMetadata && imageUrl ? (
            <Image
              alt={item.title ?? ""}
              className="bg-muted h-40 w-26.75 rounded-lg object-cover sm:h-35 sm:w-23.25"
              height={210}
              src={imageUrl}
              placeholderText={item.title}
              width={140}
              priority={priority}
            />
          ) : (
            <div className="bg-secondary text-muted-foreground flex h-40 w-26.75 shrink-0 animate-pulse items-center justify-center rounded-lg text-xs font-medium sm:h-35 sm:w-23.25">
              {item.mediaType === "movie" ? "MOV" : "SER"}
            </div>
          )}
          {rank !== undefined && (
            <span className="bg-foreground text-background border-card absolute -start-1.5 -top-1.5 flex size-6 items-center justify-center rounded-md border-2 text-[11px] font-bold tabular-nums">
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
      metaRow={
        <MediaMetaRow
          mediaType={item.mediaType}
          year={year}
          rating={item.rating}
          className="text-muted-foreground/90 dark:text-muted-foreground/75 text-[11px]"
          labelClassName="font-medium"
        />
      }
      overview={item.overview}
      overviewClassName="text-muted-foreground/80 dark:text-muted-foreground/60"
      footer={
        (item.progressStatus || item.reaction || !readOnly) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
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
            {!readOnly && (
              <div className="ms-auto flex items-center gap-1.5">
                {showSelect && (
                  <label
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelect?.();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      onSelect?.();
                    }}
                    className={cn(
                      "border-border/70 text-foreground hover:bg-secondary inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
                      selected && "bg-secondary border-foreground/30",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={() => {}}
                      aria-label={`Select ${item.title ?? "title"}`}
                      className="size-3.5"
                      style={{ accentColor: listColor || "var(--primary)" }}
                    />
                    {selected ? "Selected" : "Select"}
                  </label>
                )}
                {onMove !== undefined && (
                  <div className="border-border/70 inline-flex h-7 items-center overflow-hidden rounded-md border">
                    <button
                      type="button"
                      onClick={handleMoveClick(-1)}
                      disabled={!canMoveUp}
                      title="Move up one rank"
                      aria-label="Move up one rank"
                      className="hover:bg-secondary text-foreground flex h-full items-center gap-1 px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                    >
                      <ArrowUp aria-hidden="true" size={12} />
                      <span className="hidden sm:inline">Up</span>
                    </button>
                    <span className="bg-border/70 h-full w-px" />
                    <button
                      type="button"
                      onClick={handleMoveClick(1)}
                      disabled={!canMoveDown}
                      title="Move down one rank"
                      aria-label="Move down one rank"
                      className="hover:bg-secondary text-foreground flex h-full items-center gap-1 px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                    >
                      <ArrowDown aria-hidden="true" size={12} />
                      <span className="hidden sm:inline">Down</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleRemove}
                  aria-label="Remove from collection"
                  title="Remove from collection"
                  className="border-destructive/40 text-destructive-foreground hover:bg-destructive/10 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors"
                >
                  <TrashBin aria-hidden="true" size={12} />
                  Remove
                </button>
              </div>
            )}
          </div>
        )
      }
    />
  );
}
