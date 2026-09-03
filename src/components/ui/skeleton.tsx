import type React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "animate-skeleton rounded-sm bg-neutral-200 [--skeleton-highlight:--alpha(var(--color-white)/60%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--color-neutral-200)_0_0/200%_100%_fixed] dark:bg-neutral-800 dark:[--skeleton-highlight:--alpha(var(--color-white)/8%)] dark:[background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--color-neutral-800)_0_0/200%_100%_fixed]",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
