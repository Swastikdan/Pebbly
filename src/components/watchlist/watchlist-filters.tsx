import { Search, SlidersHorizontal, X } from "lucide-react";

import type {
  WatchlistCounts,
  WatchlistFilter,
  WatchlistFiltersModel,
  WatchlistMediaFilter,
  WatchlistReactionFilter,
  WatchlistSort,
} from "@/hooks/use-filtered-watchlist";
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
  filters,
  counts,
  filteredCount,
  totalCount,
  disabled = false,
}: {
  filters: WatchlistFiltersModel;
  counts: WatchlistCounts;
  filteredCount: number;
  totalCount: number;
  disabled?: boolean;
}) {
  const {
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
  } = filters;
  const showDroppedTab = counts.dropped > 0;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search saved titles"
            aria-label="Search watchlist"
            disabled={disabled}
            className="border-border/70 bg-card h-9 rounded-md border pr-10 pl-9 text-sm dark:border-white/10"
          />
          {searchQuery && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-lg"
              aria-label="Clear watchlist search"
            >
              <X size={14} />
            </Button>
          )}
        </div>
        <Button
          onClick={() => setFiltersOpen((prev) => !prev)}
          aria-expanded={filtersOpen}
          disabled={disabled}
          variant={
            filtersOpen || activeSecondaryCount > 0 ? "default" : "ghost"
          }
          size="sm"
          className={cn(
            "border-border/60 h-9 shrink-0 justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold dark:border-white/10",
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

      <div className="flex items-center gap-2">
        <div className="scrollbar-hidden flex min-w-0 flex-1 overflow-x-auto">
          <div className="bg-secondary/50 border-border/60 dark:bg-secondary/30 flex shrink-0 gap-0.5 rounded-lg border p-0.5 dark:border-white/10">
            {PRIMARY_TABS.map((tab) => {
              const isActive = activeFilter === tab.value;
              return (
                <Button
                  key={tab.value}
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => setActiveFilter(tab.value)}
                  className={cn(
                    "h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-[color,background-color,box-shadow]",
                    isActive
                      ? "bg-foreground text-background hover:bg-foreground"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
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
                variant="ghost"
                disabled={disabled}
                onClick={() => setActiveFilter("dropped")}
                className={cn(
                  "h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-[color,background-color,box-shadow]",
                  activeFilter === "dropped"
                    ? "bg-foreground text-background hover:bg-foreground"
                    : "text-muted-foreground/60 hover:bg-secondary/80 hover:text-foreground",
                )}
              >
                Dropped
                <span className="text-[10px] tabular-nums opacity-50">
                  {counts.dropped}
                </span>
              </Button>
            )}
          </div>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {filteredCount}/{totalCount}
        </span>
      </div>

      <div
        inert={!filtersOpen}
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
          filtersOpen
            ? "grid-rows-[1fr] opacity-100"
            : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="scrollbar-hidden flex min-h-0 items-center gap-2 overflow-x-auto">
          <Select
            disabled={disabled}
            items={MEDIA_TYPE_FILTER_ITEMS}
            value={mediaFilter}
            onValueChange={(value) =>
              setMediaFilter(value as WatchlistMediaFilter)
            }
          >
            <SelectTrigger
              size="sm"
              disabled={disabled}
              className="border-border/60 bg-secondary/50 w-auto min-w-25 gap-1.5 rounded-md border px-3 text-xs dark:border-white/10"
            >
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectPopup className="rounded-md">
              {MEDIA_TYPE_FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>

          <Select
            disabled={disabled}
            items={REACTION_FILTER_ITEMS}
            value={reactionFilter}
            onValueChange={(value) =>
              setReactionFilter(value as WatchlistReactionFilter)
            }
          >
            <SelectTrigger
              size="sm"
              disabled={disabled}
              className="border-border/60 bg-secondary/50 w-auto min-w-25 gap-1.5 rounded-md border px-3 text-xs dark:border-white/10"
            >
              <SelectValue placeholder="Mood" />
            </SelectTrigger>
            <SelectPopup className="rounded-md">
              {REACTION_FILTER_ITEMS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>

          <Select
            disabled={disabled}
            items={SORT_ITEMS}
            value={sortBy}
            onValueChange={(value) => setSortBy(value as WatchlistSort)}
          >
            <SelectTrigger
              size="sm"
              disabled={disabled}
              className="border-border/60 bg-secondary/50 w-auto min-w-30 gap-1.5 rounded-md border px-3 text-xs dark:border-white/10"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup className="rounded-md">
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
              disabled={disabled}
              onClick={resetSecondaryFilters}
              className="text-muted-foreground hover:text-foreground h-auto shrink-0 items-center gap-1 px-2.5 py-1.5 text-xs transition-colors hover:bg-transparent"
            >
              <X size={12} />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
