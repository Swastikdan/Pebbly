import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectItem,
	SelectPopup,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { REACTION_OPTIONS } from "@/constants/watchlist";
import type {
	WatchlistFilter,
	WatchlistMediaFilter,
	WatchlistReactionFilter,
	WatchlistSort,
} from "@/hooks/use-filtered-watchlist";
import { cn } from "@/lib/utils";

const PRIMARY_TABS: Array<{ value: WatchlistFilter; label: string }> = [
	{ value: "watch-later", label: "Watch Later" },
	{ value: "watching", label: "Watching" },
	{ value: "all", label: "All" },
	{ value: "done", label: "Done" },
];

const MEDIA_TYPE_FILTER_ITEMS: Array<{
	value: WatchlistMediaFilter;
	label: string;
}> = [
	{ value: "all", label: "All Types" },
	{ value: "movie", label: "Movies" },
	{ value: "tv", label: "Series" },
];

const REACTION_FILTER_ITEMS = [
	{ value: "all" as WatchlistReactionFilter, label: "All moods" },
	{ value: "none" as WatchlistReactionFilter, label: "No mood" },
	...REACTION_OPTIONS.map((option) => ({
		value: option.value as WatchlistReactionFilter,
		label: (
			<span className="flex items-center gap-2">
				<option.icon size={14} /> {option.label}
			</span>
		),
	})),
];

const SORT_ITEMS: Array<{ value: WatchlistSort; label: string }> = [
	{ value: "recent", label: "Recently Added" },
	{ value: "rating", label: "Highest Rated" },
	{ value: "title", label: "A → Z" },
	{ value: "year", label: "Newest Release" },
];

export function WatchlistFilters({
	searchQuery,
	setSearchQuery,
	activeFilter,
	setActiveFilter,
	reactionFilter,
	setReactionFilter,
	mediaFilter,
	setMediaFilter,
	sortBy,
	setSortBy,
	filtersOpen,
	setFiltersOpen,
	activeSecondaryCount,
	resetSecondaryFilters,
	counts,
	filteredCount,
	totalCount,
}: {
	searchQuery: string;
	setSearchQuery: (value: string) => void;
	activeFilter: WatchlistFilter;
	setActiveFilter: (filter: WatchlistFilter) => void;
	reactionFilter: WatchlistReactionFilter;
	setReactionFilter: (filter: WatchlistReactionFilter) => void;
	mediaFilter: WatchlistMediaFilter;
	setMediaFilter: (filter: WatchlistMediaFilter) => void;
	sortBy: WatchlistSort;
	setSortBy: (sort: WatchlistSort) => void;
	filtersOpen: boolean;
	setFiltersOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
	activeSecondaryCount: number;
	resetSecondaryFilters: () => void;
	counts: {
		all: number;
		"watch-later": number;
		watching: number;
		done: number;
		dropped: number;
	};
	filteredCount: number;
	totalCount: number;
}) {
	const showDroppedTab = counts.dropped > 0;

	return (
		<div className="mb-4 space-y-2">
			{/* Row 1 — search + filters toggle */}
			<div className="flex items-center gap-2">
				<div className="relative flex-1">
					<Search
						className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						placeholder="Search saved titles"
						aria-label="Search watchlist"
						className="h-9 rounded-xl bg-card pl-9 pr-10 text-sm"
					/>
					{searchQuery && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setSearchQuery("")}
							className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-lg text-muted-foreground"
							aria-label="Clear watchlist search"
						>
							<X size={14} />
						</Button>
					)}
				</div>
				<Button
					onClick={() => setFiltersOpen((prev) => !prev)}
					aria-expanded={filtersOpen}
					variant={
						filtersOpen || activeSecondaryCount > 0 ? "default" : "ghost"
					}
					size="sm"
					className={cn(
						"h-9 shrink-0 justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 ring-border/40",
						filtersOpen || activeSecondaryCount > 0
							? "bg-foreground text-background hover:bg-foreground/90"
							: "bg-secondary/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
					)}
				>
					<SlidersHorizontal size={13} />
					<span>{filtersOpen ? "Hide" : "Filters"}</span>
					{activeSecondaryCount > 0 && (
						<span className="text-[10px] opacity-70">
							{activeSecondaryCount}
						</span>
					)}
				</Button>
			</div>

			{/* Row 2 — status tabs + count */}
			<div className="flex items-center gap-2">
				<div className="scrollbar-hidden flex flex-1 gap-1 overflow-x-auto">
					{PRIMARY_TABS.map((tab) => {
						const isActive = activeFilter === tab.value;
						return (
							<Button
								key={tab.value}
								type="button"
								variant={isActive ? "default" : "ghost"}
								onClick={() => setActiveFilter(tab.value)}
								className={cn(
									"h-auto items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
									isActive
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-secondary hover:text-foreground",
								)}
							>
								{tab.label}
								<span
									className={cn(
										"text-[10px] tabular-nums",
										isActive ? "opacity-70" : "opacity-50",
									)}
								>
									{counts[tab.value as keyof typeof counts] ?? 0}
								</span>
							</Button>
						);
					})}
					{showDroppedTab && (
						<Button
							type="button"
							variant={activeFilter === "dropped" ? "default" : "ghost"}
							onClick={() => setActiveFilter("dropped")}
							className={cn(
								"h-auto items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
								activeFilter === "dropped"
									? "bg-foreground text-background"
									: "text-muted-foreground/60 hover:bg-secondary hover:text-foreground",
							)}
						>
							Dropped
							<span className="text-[10px] tabular-nums opacity-50">
								{counts.dropped}
							</span>
						</Button>
					)}
				</div>
				<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
					{filteredCount}/{totalCount}
				</span>
			</div>

			<div
				className={cn(
					"flex-1 items-center gap-2 scrollbar-hidden overflow-x-auto",
					filtersOpen ? "flex" : "hidden",
				)}
			>
				<Select
					items={MEDIA_TYPE_FILTER_ITEMS}
					value={mediaFilter}
					onValueChange={(value) =>
						setMediaFilter(value as WatchlistMediaFilter)
					}
				>
					<SelectTrigger
						size="sm"
						className="w-auto min-w-[100px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs"
					>
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectPopup className="rounded-xl">
						{MEDIA_TYPE_FILTER_ITEMS.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>

				<Select
					items={REACTION_FILTER_ITEMS}
					value={reactionFilter}
					onValueChange={(value) =>
						setReactionFilter(value as WatchlistReactionFilter)
					}
				>
					<SelectTrigger
						size="sm"
						className="w-auto min-w-[100px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs"
					>
						<SelectValue placeholder="Mood" />
					</SelectTrigger>
					<SelectPopup className="rounded-xl">
						{REACTION_FILTER_ITEMS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>

				<Select
					items={SORT_ITEMS}
					value={sortBy}
					onValueChange={(value) => setSortBy(value as WatchlistSort)}
				>
					<SelectTrigger
						size="sm"
						className="w-auto min-w-[120px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectPopup className="rounded-xl">
						{SORT_ITEMS.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>

				{activeSecondaryCount > 0 && (
					<Button
						type="button"
						variant="ghost"
						onClick={resetSecondaryFilters}
						className="h-auto items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
					>
						<X size={12} />
						Reset
					</Button>
				)}
			</div>
		</div>
	);
}
