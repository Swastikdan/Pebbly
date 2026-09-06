import type React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "before:animate-skeleton relative overflow-hidden rounded-sm bg-neutral-200 before:absolute before:inset-0 before:bg-[linear-gradient(120deg,transparent_40%,--alpha(var(--color-white)/60%)_50%,transparent_60%)] before:will-change-transform dark:bg-neutral-800 dark:before:bg-[linear-gradient(120deg,transparent_40%,--alpha(var(--color-white)/8%)_50%,transparent_60%)]",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
