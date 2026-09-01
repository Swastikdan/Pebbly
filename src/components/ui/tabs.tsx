"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import type { SegmentedControlSize } from "@/lib/segmented-control";
import {
  segmentedControlItemLayoutClassName,
  segmentedControlItemSizeClassNames,
} from "@/lib/segmented-control";
import { cn } from "@/lib/utils";

type TabsVariant = "default" | "underline";
type TabsSize = SegmentedControlSize;

const TabsListContext: React.Context<TabsSize> =
  React.createContext<TabsSize>("default");

export function Tabs({
  className,
  ...props
}: TabsPrimitive.Root.Props): React.ReactElement {
  return (
    <TabsPrimitive.Root
      className={cn(
        "flex flex-col gap-2 data-[orientation=vertical]:flex-row",
        className,
      )}
      data-slot="tabs"
      {...props}
    />
  );
}

export function TabsList({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: TabsPrimitive.List.Props & {
  size?: TabsSize;
  variant?: TabsVariant;
}): React.ReactElement {
  return (
    <TabsPrimitive.List
      className={cn(
        "text-muted-foreground relative z-0 flex w-fit items-center justify-center gap-x-0.5",
        "data-[orientation=vertical]:flex-col",
        variant === "default"
          ? "bg-muted text-muted-foreground/72 rounded-md p-0.5"
          : "*:data-[slot=tabs-tab]:hover:bg-accent data-[orientation=horizontal]:py-1 data-[orientation=vertical]:px-1",
        className,
      )}
      data-size={size}
      data-slot="tabs-list"
      {...props}
    >
      <TabsListContext.Provider value={size}>
        {children}
      </TabsListContext.Provider>
      <TabsPrimitive.Indicator
        className={cn(
          "ease-emphatic absolute top-0 left-0 transition-[translate,width,height] duration-150",
          variant === "underline"
            ? "bg-primary z-10 data-[orientation=horizontal]:top-auto data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-(--active-tab-width) data-[orientation=horizontal]:[translate:var(--active-tab-left)_0] data-[orientation=vertical]:h-(--active-tab-height) data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:[translate:0_var(--active-tab-top)]"
            : "bg-background dark:bg-input -z-1 h-(--active-tab-height) w-(--active-tab-width) [translate:var(--active-tab-left)_var(--active-tab-top)] rounded-sm shadow-none",
        )}
        data-slot="tab-indicator"
      />
    </TabsPrimitive.List>
  );
}

export function TabsTab({
  className,
  size,
  ...props
}: TabsPrimitive.Tab.Props & {
  size?: TabsSize;
}): React.ReactElement {
  const contextSize: TabsSize = React.useContext(TabsListContext);
  const resolvedSize: TabsSize = size ?? contextSize;

  return (
    <TabsPrimitive.Tab
      className={cn(
        "hover:text-muted-foreground focus-visible:ring-ring data-active:text-foreground relative flex shrink-0 grow cursor-pointer items-center justify-center rounded-md border border-transparent text-base font-medium whitespace-nowrap outline-hidden transition-[color,background-color,box-shadow] focus-visible:ring-2 data-disabled:pointer-events-none data-disabled:opacity-64 data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start sm:text-sm",
        segmentedControlItemLayoutClassName,
        segmentedControlItemSizeClassNames[resolvedSize],
        className,
      )}
      data-size={resolvedSize}
      data-slot="tabs-tab"
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: TabsPrimitive.Panel.Props): React.ReactElement {
  return (
    <TabsPrimitive.Panel
      className={cn("flex-1 outline-hidden", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export {
  TabsPanel as TabsContent,
  TabsPrimitive,
  type TabsSize,
  TabsTab as TabsTrigger,
  type TabsVariant,
};
