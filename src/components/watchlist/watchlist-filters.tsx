import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
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
		<div className="mb-6 space-y-3 rounded-2xl border border-border/60 bg-card/35 p-3 shadow-sm sm:p-4">
			<div className="relative">
				<Search
					className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					value={searchQuery}
					onChange={(event) => setSearchQuery(event.target.value)}
					placeholder="Search saved titles, details, or release year"
					aria-label="Search watchlist"
					className="h-10 rounded-xl bg-background pl-9 pr-10 text-sm"
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

				<Button
					onClick={() => setFiltersOpen((prev) => !prev)}
					aria-expanded={filtersOpen}
					variant={
						filtersOpen || activeSecondaryCount > 0 ? "default" : "ghost"
					}
					size="sm"
					className={cn(
						"h-9 w-[132px] justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 ring-border/40",
						filtersOpen || activeSecondaryCount > 0
							? "bg-foreground text-background hover:bg-foreground/90"
							: "bg-secondary/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
					)}
				>
					<SlidersHorizontal size={13} />
					<span className="relative inline-flex w-[72px] justify-center">
						<span
							className={cn(
								"absolute inset-0 transition-opacity",
								filtersOpen ? "opacity-100" : "opacity-0",
							)}
						>
							Hide
						</span>
						<span
							className={cn(
								"absolute inset-0 transition-opacity",
								filtersOpen ? "opacity-0" : "opacity-100",
							)}
						>
							Filters
						</span>
						<span className="invisible">Filters</span>
					</span>
					{activeSecondaryCount > 0 && (
						<span className="text-[10px] opacity-70">
							{activeSecondaryCount}
						</span>
					)}
				</Button>
			</div>

			<div
				className={cn(
					"flex-1 items-center gap-2 scrollbar-hidden overflow-x-auto",
					filtersOpen ? "flex" : "hidden",
				)}
			>
				<Select
					value={mediaFilter}
					onValueChange={(value) =>
						setMediaFilter(value as WatchlistMediaFilter)
					}
				>
					<SelectTrigger className="w-auto min-w-[100px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectContent className="rounded-xl">
						<SelectItem value="all">All Types</SelectItem>
						<SelectItem value="movie">Movies</SelectItem>
						<SelectItem value="tv">Series</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={reactionFilter}
					onValueChange={(value) =>
						setReactionFilter(value as WatchlistReactionFilter)
					}
				>
					<SelectTrigger className="w-auto min-w-[100px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
						<SelectValue placeholder="Mood" />
					</SelectTrigger>
					<SelectContent className="rounded-xl">
						<SelectItem value="all">All moods</SelectItem>
						<SelectItem value="none">No mood</SelectItem>
						{REACTION_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								<span className="flex items-center gap-2">
									<option.icon size={14} /> {option.label}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={sortBy}
					onValueChange={(value) => setSortBy(value as WatchlistSort)}
				>
					<SelectTrigger className="w-auto min-w-[120px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="rounded-xl">
						<SelectItem value="recent">Recently Added</SelectItem>
						<SelectItem value="rating">Highest Rated</SelectItem>
						<SelectItem value="title">A → Z</SelectItem>
						<SelectItem value="year">Newest Release</SelectItem>
					</SelectContent>
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
			<div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
				<span>
					Showing {filteredCount} of {totalCount} saved
				</span>
				{totalCount >= 25 && (
					<span className="hidden sm:inline">
						Use Collections to group a big queue.
					</span>
				)}
			</div>
		</div>
	);
}
