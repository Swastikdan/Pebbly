import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

const TabsContext = React.createContext<{ activeValue?: string } | null>(null);

function Tabs({
	className,
	value,
	defaultValue,
	onValueChange,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	const isControlled = value !== undefined;
	const [localValue, setLocalValue] = React.useState(defaultValue);

	const activeValue = isControlled ? value : localValue;

	const handleValueChange = (val: string) => {
		if (!isControlled) {
			setLocalValue(val);
		}
		onValueChange?.(val);
	};

	return (
		<TabsContext.Provider value={{ activeValue }}>
			<TabsPrimitive.Root
				data-slot="tabs"
				className={cn("flex flex-col gap-2", className)}
				value={activeValue}
				onValueChange={handleValueChange}
				{...props}
			/>
		</TabsContext.Provider>
	);
}

function TabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn(
				"bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-1",
				// Section tabs (home, media page, watchlist) use a compact pill
				// segmented control — folded in here so every call site shares one
				// source of truth.
				"m-1 h-8 rounded-full bg-secondary/50 p-0.5 ring-1 ring-border/70",
				className,
			)}
			{...props}
		/>
	);
}

function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				"data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow,background-color] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				// Compact section-tab trigger (see TabsList) — same source of truth.
				"h-7 rounded-full px-3.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground data-[state=active]:bg-surface-3 data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgb(0_0_0/0.2),inset_0_1px_0_color-mix(in_oklab,var(--primary)_10%,transparent)]",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({
	className,
	value,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	const context = React.useContext(TabsContext);
	const isActive = context?.activeValue === value;
	const [hasRendered, setHasRendered] = React.useState(isActive);

	React.useEffect(() => {
		if (isActive) {
			setHasRendered(true);
		}
	}, [isActive]);

	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn(
				"flex-1 outline-none data-[state=active]:animate-tab-fade-in",
				className,
			)}
			value={value}
			{...props}
		>
			{hasRendered ? props.children : null}
		</TabsPrimitive.Content>
	);
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
