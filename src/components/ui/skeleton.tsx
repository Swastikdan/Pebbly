import type React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "before:animate-skeleton relative overflow-hidden rounded-sm bg-neutral-200 before:absolute before:inset-0 before:bg-[linear-gradient(120deg,transparent_40%,--alpha(var(--color-white)/52%)_50%,transparent_60%)] before:will-change-transform before:backface-hidden dark:bg-neutral-800 dark:before:bg-[linear-gradient(120deg,transparent_40%,--alpha(var(--color-white)/7%)_50%,transparent_60%)]",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
