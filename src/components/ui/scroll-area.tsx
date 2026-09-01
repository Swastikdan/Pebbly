"use client";

import type * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@/lib/utils";

export function ScrollArea({
  className,
  children,
  overscrollContain = false,
  scrollbarGutter = false,
  scrollFade = false,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  overscrollContain?: boolean;
  scrollbarGutter?: boolean;
  scrollFade?: boolean;
}): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Root
      className={cn(
        "relative overflow-hidden",
        overscrollContain && "overscroll-contain",
        className,
      )}
      data-slot="scroll-area"
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "size-full overflow-y-auto",
          scrollbarGutter && "[scrollbar-gutter:stable]",
          scrollFade && "mask-t-from-98%",
        )}
        data-slot="scroll-area-viewport"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        className="flex w-2 justify-center rounded-full bg-transparent p-0.5 opacity-0 transition-opacity hover:flex data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:hover:flex"
        data-slot="scroll-area-scrollbar"
        orientation="vertical"
      >
        <ScrollAreaPrimitive.Thumb
          className="bg-border w-full rounded-full"
          data-slot="scroll-area-thumb"
        />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
