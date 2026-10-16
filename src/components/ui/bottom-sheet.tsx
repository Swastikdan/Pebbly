"use client";

import type React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { XIcon } from "@/components/ui/hugeicons";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet built on Base UI's Drawer.
 *
 * Unlike the generic `Sheet` (a CSS-transition panel), the Drawer is a real
 * gesture surface: it tracks the finger 1:1, rubber-bands at the top edge,
 * carries the release velocity into the settle animation, and can be grabbed
 * and reversed while it is still moving. This is the primitive to reach for on
 * touch — Apple's canonical "swipe down to dismiss" surface.
 */
export const BottomSheet: typeof DrawerPrimitive.Root = DrawerPrimitive.Root;

export function BottomSheetTrigger(
  props: DrawerPrimitive.Trigger.Props,
): React.ReactElement {
  return (
    <DrawerPrimitive.Trigger data-slot="bottom-sheet-trigger" {...props} />
  );
}

export function BottomSheetClose(
  props: DrawerPrimitive.Close.Props,
): React.ReactElement {
  return <DrawerPrimitive.Close data-slot="bottom-sheet-close" {...props} />;
}

function BottomSheetBackdrop({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props): React.ReactElement {
  return (
    <DrawerPrimitive.Backdrop
      className={cn(
        "ease-standard fixed inset-0 z-50 bg-black/45 [opacity:calc(1-var(--drawer-swipe-progress,0))] backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60",
        className,
      )}
      data-slot="bottom-sheet-backdrop"
      {...props}
    />
  );
}

export function BottomSheetPopup({
  className,
  children,
  showCloseButton = true,
  closeProps,
  portalProps,
  viewportClassName,
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  closeProps?: DrawerPrimitive.Close.Props;
  portalProps?: DrawerPrimitive.Portal.Props;
  viewportClassName?: string;
}): React.ReactElement {
  const {
    className: closeClassName,
    ...closeRest
  }: DrawerPrimitive.Close.Props = closeProps ?? {};

  return (
    <DrawerPrimitive.Portal {...portalProps}>
      <BottomSheetBackdrop />
      <DrawerPrimitive.Viewport
        className={cn(
          "fixed inset-0 z-50 grid grid-rows-[1fr_auto] pt-12",
          viewportClassName,
        )}
        data-slot="bottom-sheet-viewport"
      >
        <DrawerPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground ease-drawer relative row-start-2 flex max-h-[90dvh] min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl outline-hidden",
            "transition-[translate,transform] duration-300 will-change-transform data-ending-style:translate-y-full data-starting-style:translate-y-full",
            className,
          )}
          data-slot="bottom-sheet-popup"
          {...props}
        >
          {/* Grabber — the affordance that says "you can pull me down". Works
              together with the Base UI swipe gesture handled by the Drawer
              viewport. */}
          <div
            aria-hidden="true"
            className="flex shrink-0 justify-center pt-2.5 pb-1"
          >
            <div className="bg-muted-foreground/30 h-1.5 w-10 rounded-full" />
          </div>
          {children}
          {showCloseButton && (
            <DrawerPrimitive.Close
              aria-label="Close"
              {...closeRest}
              className={cn(
                "text-muted-foreground hover:text-foreground bg-background border-border/60 absolute end-4 top-4 z-50 cursor-pointer rounded-lg border p-2 shadow-xs transition-[color,background-color,box-shadow,transform] duration-150 ease-out hover:bg-neutral-100 active:scale-[0.96] dark:hover:bg-neutral-800",
                typeof closeClassName === "string" ? closeClassName : undefined,
              )}
            >
              <XIcon aria-hidden="true" className="size-5.5" />
              <span className="sr-only">Close</span>
            </DrawerPrimitive.Close>
          )}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}

export function BottomSheetHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("flex flex-col gap-2 p-6", className)}
      data-slot="bottom-sheet-header"
      {...props}
    >
      {children}
    </div>
  );
}

export function BottomSheetFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "bg-muted/72 flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="bottom-sheet-footer"
      {...props}
    >
      {children}
    </div>
  );
}

export function BottomSheetTitle({
  className,
  ...props
}: DrawerPrimitive.Title.Props): React.ReactElement {
  return (
    <DrawerPrimitive.Title
      className={cn(
        "font-heading text-xl leading-none font-semibold",
        className,
      )}
      data-slot="bottom-sheet-title"
      {...props}
    />
  );
}

export function BottomSheetDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props): React.ReactElement {
  return (
    <DrawerPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="bottom-sheet-description"
      {...props}
    />
  );
}

export { DrawerPrimitive as BottomSheetPrimitive };
