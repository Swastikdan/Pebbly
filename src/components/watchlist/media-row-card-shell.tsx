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
        "border-border/60 bg-card hover:border-border/90 dark:border-border/40 dark:hover:border-border/70 group relative flex gap-3.5 border p-3.5 shadow-xs transition-colors dark:shadow-none",
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
