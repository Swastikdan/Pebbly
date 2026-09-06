import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { Star } from "@/components/ui/icons";
import { IMAGE_PREFIX } from "@/constants";
import { cn } from "@/lib/utils";

export function resolvePosterSrc(
  image?: string | null,
  backdrop?: string | null,
) {
  if (image) return `${IMAGE_PREFIX.LQ_POSTER}${image}`;
  if (backdrop) return `${IMAGE_PREFIX.LQ_BACKDROP}${backdrop}`;
  return undefined;
}

export function releaseYearOf(releaseDate?: string | null) {
  return releaseDate ? new Date(releaseDate).getFullYear() : null;
}

export function MediaChip({
  icon: Icon,
  label,
  title,
}: {
  icon: ComponentType<{
    size?: string | number;
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  label: string;
  title?: string;
}) {
  return (
    <span
      className="bg-secondary/80 text-secondary-foreground inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium"
      title={title}
    >
      <Icon aria-hidden="true" size={12} />
      {label}
    </span>
  );
}

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
  const formattedMediaType =
    mediaType?.toLowerCase() === "tv"
      ? "TV"
      : mediaType?.toLowerCase() === "movie"
        ? "Movie"
        : mediaType
          ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1)
          : "";

  return (
    <div className={cn("mt-1.5 flex flex-wrap items-center gap-2", className)}>
      {formattedMediaType && (
        <span className={cn("font-medium", labelClassName)}>
          {formattedMediaType}
        </span>
      )}
      {year && (
        <>
          <span
            className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <span className="font-medium">{year}</span>
        </>
      )}
      {(rating ?? 0) > 0 && (
        <>
          <span
            className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <span className="border-border/60 bg-muted/60 text-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold">
            <Star
              aria-hidden="true"
              className="size-3 shrink-0 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
            />
            <span>{rating?.toFixed(1)}</span>
          </span>
        </>
      )}
    </div>
  );
}

type MediaRowCardShellProps = {
  to: string;
  className?: string;
  poster: ReactNode;
  title: ReactNode;
  titleClassName?: string;
  actions?: ReactNode;
  metaRow: ReactNode;
  overview?: string;
  overviewClassName?: string;
  footer?: ReactNode;
};

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
        "border-border/60 bg-card hover:border-border/90 dark:border-border/40 dark:hover:border-border/70 group relative flex gap-3.5 border p-3.5 transition-colors dark:shadow-none",
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
                "mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-pretty",
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
