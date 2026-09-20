import type React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "before:animate-skeleton relative overflow-hidden rounded-sm bg-neutral-200 before:absolute before:inset-y-0 before:-start-[60%] before:w-[60%] before:bg-[linear-gradient(120deg,transparent_30%,--alpha(var(--color-white)/52%)_50%,transparent_70%)] dark:bg-neutral-800 dark:before:bg-[linear-gradient(120deg,transparent_30%,--alpha(var(--color-white)/7%)_50%,transparent_70%)]",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
