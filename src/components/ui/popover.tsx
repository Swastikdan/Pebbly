"use client";

import type * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

export const Popover: typeof PopoverPrimitive.Root = PopoverPrimitive.Root;

export const PopoverPortal: typeof PopoverPrimitive.Portal =
  PopoverPrimitive.Portal;

export function PopoverTrigger(
  props: PopoverPrimitive.Trigger.Props,
): React.ReactElement {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export function PopoverClose(
  props: PopoverPrimitive.Close.Props,
): React.ReactElement {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

export function PopoverPopup({
  children,
  className,
  sideOffset = 8,
  align = "start",
  alignOffset,
  side = "bottom",
  anchor,
  portalProps,
  ...props
}: PopoverPrimitive.Popup.Props & {
  align?: PopoverPrimitive.Positioner.Props["align"];
  sideOffset?: PopoverPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: PopoverPrimitive.Positioner.Props["alignOffset"];
  side?: PopoverPrimitive.Positioner.Props["side"];
  anchor?: PopoverPrimitive.Positioner.Props["anchor"];
  portalProps?: PopoverPrimitive.Portal.Props;
}): React.ReactElement {
  return (
    <PopoverPortal {...portalProps}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50"
        data-slot="popover-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground relative flex origin-(--transform-origin) rounded-xl border shadow-xl outline-hidden focus:outline-hidden",
            "transition-[transform,opacity] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          data-slot="popover-popup"
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  );
}
