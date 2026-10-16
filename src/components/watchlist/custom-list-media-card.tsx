import { memo } from "react";
import { Link } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import type { ProgressStatus, ReactionStatus } from "@/domain/watchlist";
import type { ReorderHandleProps } from "@/hooks/use-reorder-drag";
import { ArrowDown, ArrowUp, Check } from "@/components/ui/hugeicons";
import { TrashBin } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { releaseYearOf } from "@/components/watchlist/media-row-card-shell";
import { IMAGE_PREFIX } from "@/constants";
import { getProgressOption, getReactionOption } from "@/constants/watchlist";
import { cn, formatMediaTitle } from "@/lib/utils";

function CustomListMediaCardImpl({
  item,
  priority,
  readOnly,
  rank,
  onMove,
  canMoveUp,
  canMoveDown,
  selected,
  onSelect,
  showSelect,
  onRemove,
  reorderIndex,
  isDragging,
  dragHandleProps,
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
  onRemove?: () => void;
  /** Index used by the reorder hit-testing; also marks the card as draggable. */
  reorderIndex?: number;
  /** True while this card is the one being dragged. */
  isDragging?: boolean;
  /** Pointer handlers that turn the rank badge into a drag handle. */
  dragHandleProps?: ReorderHandleProps;
}) {
  const formattedTitle = item.title
    ? formatMediaTitle.encode(item.title)
    : undefined;

  // SD quality (w500) for crisp posters in the grid
  const posterSrc = item.image
    ? `${IMAGE_PREFIX.SD_POSTER}${item.image}`
    : item.backdrop
      ? `${IMAGE_PREFIX.SD_BACKDROP}${item.backdrop}`
      : undefined;

  const year = releaseYearOf(item.release_date);

  const progressOption = item.progressStatus
    ? getProgressOption(item.progressStatus)
    : null;
  const reactionOption = item.reaction
    ? getReactionOption(item.reaction)
    : null;

  const routeType = item.mediaType === "tv" ? "series" : item.mediaType;
  const to = formattedTitle
    ? `/${routeType}/${item.tmdbId}/${formattedTitle}`
    : `/${routeType}/${item.tmdbId}`;

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove?.();
  };

  const handleMoveClick = (dir: -1 | 1) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMove?.(dir);
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();
  };

  return (
    <div
      className={cn(
        "group/card relative flex flex-col",
        isDragging && "z-50",
        isDragging && "drop-shadow-2xl",
      )}
      data-reorder-index={reorderIndex}
    >
      {/* ── Poster container ─────────────────────────── */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl">
        {/* Poster / fallback */}
        <Link
          to={to}
          className="absolute inset-0"
          aria-label={item.title ?? `${item.mediaType} #${item.tmdbId}`}
        >
          {posterSrc ? (
            <Image
              src={posterSrc}
              alt={item.title ?? ""}
              layout="fullWidth"
              className="size-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-[1.04]"
              priority={priority}
            />
          ) : (
            <div className="bg-muted text-muted-foreground/40 flex size-full items-center justify-center text-[11px] font-semibold tracking-widest uppercase">
              {item.mediaType === "movie" ? "Movie" : "Series"}
            </div>
          )}
          {/* Permanent bottom vignette */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
        </Link>

        {/* ── Selected state: simple white/dark overlay, no coloured ring ── */}
        {selected && (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-white/10 ring-2 ring-white/60 ring-inset dark:bg-white/[0.07] dark:ring-white/30" />
        )}

        {/* ── Rank badge — top-left (drag handle when reorderable) ── */}
        {rank !== undefined &&
          (dragHandleProps ? (
            <button
              type="button"
              {...dragHandleProps}
              aria-label={`Reorder rank ${rank}. Drag to move, or use the arrow buttons.`}
              title="Drag to reorder"
              className="absolute start-2 top-2 z-20 flex size-8 min-w-8 cursor-grab touch-none items-center justify-center rounded-lg border border-white/80 bg-neutral-950 px-1.5 text-[11px] font-bold text-white tabular-nums shadow-md select-none active:cursor-grabbing"
            >
              {rank}
            </button>
          ) : (
            <div className="absolute start-2 top-2 z-20 flex size-8 min-w-8 items-center justify-center rounded-lg border border-white/80 bg-neutral-950 px-1.5 text-[11px] font-bold text-white tabular-nums shadow-md">
              {rank}
            </div>
          ))}

        {/* ── Status + Reaction chips — bottom ─────── */}
        <div className="pointer-events-none absolute start-2 end-2 bottom-2 z-20 flex items-end justify-between gap-1">
          {progressOption && (
            <span className="flex h-6 items-center gap-1.5 rounded-md bg-black/65 px-2 text-[11px] font-semibold text-white backdrop-blur-sm">
              <progressOption.icon aria-hidden="true" size={11} />
              {progressOption.label}
            </span>
          )}
          {reactionOption && (
            <span className="ms-auto flex h-6 items-center gap-1.5 rounded-md bg-black/65 px-2 text-[11px] font-semibold text-white backdrop-blur-sm">
              <reactionOption.icon aria-hidden="true" size={11} />
              <span className="sr-only">{reactionOption.label}</span>
            </span>
          )}
        </div>

        {/* ── Action buttons overlay (top) ─────────── */}
        {!readOnly && (
          <div className="collection-card-actions absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 transition-[opacity,transform] duration-150 ease-out">
            {/* Move + Remove — top-right */}
            <div className="ms-auto flex items-center gap-1">
              {showSelect && (
                <button
                  type="button"
                  onClick={handleSelect}
                  aria-label={selected ? "Deselect" : "Select"}
                  className={cn(
                    "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border shadow-md transition-[transform,color,background-color,border-color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.97]",
                    selected
                      ? "bg-foreground border-foreground text-background"
                      : "border-white/80 bg-neutral-950 text-transparent hover:bg-neutral-800",
                  )}
                >
                  {selected && (
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  )}
                </button>
              )}
              {onMove !== undefined && (
                <>
                  <button
                    type="button"
                    onClick={handleMoveClick(-1)}
                    disabled={!canMoveUp}
                    title="Move up"
                    aria-label="Move up one rank"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/80 bg-neutral-950 text-white shadow-md transition-[transform,background-color,color] duration-150 ease-out hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-neutral-950"
                  >
                    <ArrowUp aria-hidden="true" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleMoveClick(1)}
                    disabled={!canMoveDown}
                    title="Move down"
                    aria-label="Move down one rank"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/80 bg-neutral-950 text-white shadow-md transition-[transform,background-color,color] duration-150 ease-out hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-neutral-950"
                  >
                    <ArrowDown aria-hidden="true" size={14} />
                  </button>
                </>
              )}
              {onRemove !== undefined && (
                <button
                  type="button"
                  onClick={handleRemove}
                  aria-label="Remove from collection"
                  title="Remove"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/80 bg-neutral-950 text-white shadow-md transition-[transform,background-color,color,border-color] duration-150 ease-out hover:border-red-300 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white active:scale-[0.97]"
                >
                  <TrashBin aria-hidden="true" size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────── */}
      <div className="mt-2 min-w-0 px-0.5">
        <Link to={to} tabIndex={-1} aria-hidden="true">
          <h3
            className={cn(
              "line-clamp-2 text-[13px] leading-snug font-semibold transition-colors duration-150",
              selected
                ? "text-primary"
                : "text-foreground group-hover/card:text-primary",
            )}
          >
            {item.title ??
              `${item.mediaType === "movie" ? "Movie" : "TV Show"} #${item.tmdbId}`}
          </h3>
        </Link>
        <div className="text-muted-foreground/70 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
          <span className="font-medium">
            {item.mediaType === "tv" ? "TV" : "Movie"}
          </span>
          {year && (
            <>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>{year}</span>
            </>
          )}
          {(item.rating ?? 0) > 0 && (
            <>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>★ {item.rating?.toFixed(1)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized: this card renders up to 100× per page. A `memo` boundary lets the
 * reconciler skip every untouched card when one card's selection state flips
 * or a sibling is removed, instead of re-rendering all 100 subtrees in one
 * main-thread block.
 */
export const CustomListMediaCard = memo(CustomListMediaCardImpl);

CustomListMediaCard.displayName = "CustomListMediaCard";
