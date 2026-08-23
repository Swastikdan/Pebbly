import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Responsive horizontal media-card grid used across home, search, list, and
 * recommendation pages. `stagger` adds the staggered-entrance animation used
 * on full-page grids.
 */
export function MediaGrid({
  stagger = false,
  className,
  children,
}: {
  stagger?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid w-full grid-cols-2 justify-items-center gap-5 px-1 py-10 sm:grid-cols-3 sm:px-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        stagger && "stagger-grid",
        className,
      )}
    >
      {children}
    </div>
  );
}
