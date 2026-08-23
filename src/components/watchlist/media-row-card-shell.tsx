import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { Star } from "@/components/ui/icons";
import { IMAGE_PREFIX } from "@/constants";
import { cn } from "@/lib/utils";

/** `LQ_POSTER`/`LQ_BACKDROP` URL for a poster path with optional backdrop fallback. */
export function resolvePosterSrc(
  image?: string | null,
  backdrop?: string | null,
) {
  if (image) return `${IMAGE_PREFIX.LQ_POSTER}${image}`;
  if (backdrop) return `${IMAGE_PREFIX.LQ_BACKDROP}${backdrop}`;
  return undefined;
}

/** Release year parsed from a TMDB date string, or null when absent. */
export function releaseYearOf(releaseDate?: string | null) {
  return releaseDate ? new Date(releaseDate).getFullYear() : null;
}

/**
 * The static status/reaction pill shared by the watchlist and collection
 * cards ("bg-secondary/80 …" chip). The interactive status-cycle button is
 * NOT this — that control stays card-specific.
 */
export function MediaChip({
  icon: Icon,
  label,
  title,
}: {
  icon: ComponentType<{ size?: string | number; className?: string }>;
  label: string;
  title?: string;
}) {
  return (
    <span
      className="bg-secondary/80 text-secondary-foreground inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium"
      title={title}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

/**
 * `type · year · rating` row rendered under the card title. Cards supply
 * their own color/size classes via className and their type-label styling
 * via labelClassName.
 */
export function MediaMetaRow({
  mediaType,
  year,
  rating,
  className,
  labelClassName,
}: {
  mediaType: string;
  year: number | null;
  rating?: number | null;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("mt-1 flex items-center gap-1.5", className)}>
      <span className={labelClassName}>{mediaType}</span>
      {year && (
        <>
          <span className="text-border">·</span>
          <span>{year}</span>
        </>
      )}
      {(rating ?? 0) > 0 && (
        <>
          <span className="text-border">·</span>
          <span className="flex items-center gap-0.5">
            <Star className="size-2.5 fill-yellow-400 text-yellow-400" />
            {rating?.toFixed(1)}
          </span>
        </>
      )}
    </div>
  );
}

type MediaRowCardShellProps = {
  to: string;
  /** Card-specific container classes (radius, hover motion) merged over the shared base. */
  className?: string;
  /** Poster column contents — image, fallback block, or rank badge + image. */
  poster: ReactNode;
  title: ReactNode;
  /** Extra h3 classes, e.g. group-hover tinting. */
  titleClassName?: string;
  /** Top-right controls next to the title (status cycle button or rank arrows). */
  actions?: ReactNode;
  /** Meta row under the title, usually a `MediaMetaRow`. */
  metaRow: ReactNode;
  overview?: string;
  overviewClassName?: string;
  /** Bottom chip area; the caller supplies its own wrapper so spacing stays exact. */
  footer?: ReactNode;
};

/**
 * Shared skeleton for the horizontal media row cards (watchlist grid +
 * custom-collection items): link container, poster column, title/actions
 * header row, meta row, overview clamp, and a footer slot.
 */
export function MediaRowCardShell({
  to,
  className,
  poster,
  title,
  titleClassName,
  actions,
  metaRow,
  overview,
  overviewClassName,
  footer,
}: MediaRowCardShellProps) {
  return (
    <Link
      to={to}
      className={cn(
        "border-border/40 bg-card hover:border-border/70 group relative flex gap-3.5 border p-3.5 transition-colors",
        className,
      )}
    >
      <div className="relative shrink-0">{poster}</div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "line-clamp-2 text-sm leading-snug font-semibold",
                titleClassName,
              )}
            >
              {title}
            </h3>

            {actions}
          </div>

          {metaRow}

          {overview && (
            <p
              className={cn(
                "mt-1.5 line-clamp-2 text-xs leading-relaxed",
                overviewClassName,
              )}
            >
              {overview}
            </p>
          )}
        </div>

        {footer}
      </div>
    </Link>
  );
}
