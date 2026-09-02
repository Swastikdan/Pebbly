import {
  ArrowUpRight,
  Clock,
  Film,
  Plus,
  RefreshCw,
  Trash2,
  Tv,
} from "lucide-react";

import type { RecommendationHistoryEntry } from "@/hooks/use-recommendations";
import { formatTimestamp } from "@/components/recommendations/recommendation-utils";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RecommendationHistory({
  entries,
  activeEntryId,
  isGenerating,
  onSelect,
  onDelete,
  onGenerateAgain,
  onGenerateMore,
}: {
  entries: RecommendationHistoryEntry[];
  activeEntryId: string | null;
  isGenerating: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onGenerateAgain: (entry: RecommendationHistoryEntry) => void;
  onGenerateMore: (entry: RecommendationHistoryEntry) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
        <Clock className="size-4" />
        History
      </h2>
      <Accordion className="mb-10 space-y-2">
        {entries.map((entry) => (
          <HistoryAccordionItem
            key={entry.id}
            entry={entry}
            isActive={entry.id === activeEntryId}
            onSelect={() => onSelect(entry.id)}
            onDelete={() => onDelete(entry.id)}
            onGenerateAgain={() => onGenerateAgain(entry)}
            onGenerateMore={() => onGenerateMore(entry)}
            isGenerating={isGenerating}
          />
        ))}
      </Accordion>
    </div>
  );
}

function HistoryAccordionItem({
  entry,
  isActive,
  onSelect,
  onDelete,
  onGenerateAgain,
  onGenerateMore,
  isGenerating,
}: {
  entry: RecommendationHistoryEntry;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onGenerateAgain: () => void;
  onGenerateMore: () => void;
  isGenerating: boolean;
}) {
  const movieCount = entry.recommendations.filter(
    (r) => r.mediaType === "movie",
  ).length;
  const tvCount = entry.recommendations.filter(
    (r) => r.mediaType === "tv",
  ).length;
  const avgScore = entry.recommendations.length
    ? Math.round(
        entry.recommendations.reduce((s, r) => s + r.relevanceScore, 0) /
          entry.recommendations.length,
      )
    : 0;

  return (
    <AccordionItem
      value={entry.id}
      className={cn(
        "border-border bg-card overflow-hidden rounded-lg border transition-colors",
        isActive && "ring-border ring-1",
      )}
    >
      <AccordionTrigger className="hover:bg-secondary/10 data-panel-open:bg-secondary/10 px-4 py-3 text-sm font-medium transition-colors hover:no-underline">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pr-2">
          <Badge
            variant="outline"
            className="shrink-0 text-[10px] font-medium capitalize"
          >
            {entry.generationType === "genre"
              ? "Genre"
              : entry.generationType === "list"
                ? "Custom List"
                : "Watchlist"}
          </Badge>

          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {entry.genrePreference
              ? entry.genrePreference
              : `${entry.inputStats.movieCount} movies, ${entry.inputStats.tvCount} TV`}
            {entry.mediaTypePreference &&
              ` · ${entry.mediaTypePreference === "movie" ? "Movies" : "TV"}`}
          </span>

          <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
            {movieCount > 0 && (
              <span className="text-muted-foreground/60 inline-flex items-center gap-1 text-[10px]">
                <Film className="size-3" />
                {movieCount}
              </span>
            )}
            {tvCount > 0 && (
              <span className="text-muted-foreground/60 inline-flex items-center gap-1 text-[10px]">
                <Tv className="size-3" />
                {tvCount}
              </span>
            )}
            <span
              className={cn(
                "text-[10px] font-semibold tabular-nums",
                avgScore >= 80
                  ? "text-emerald-600 dark:text-emerald-400"
                  : avgScore >= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {avgScore}% Match
            </span>
          </div>

          <div className="text-muted-foreground/60 flex w-full items-center gap-2 text-[11px] sm:hidden">
            <span>{formatTimestamp(entry.createdAt)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{entry.recommendations.length} results</span>
          </div>

          <span className="text-muted-foreground/60 hidden shrink-0 text-[11px] sm:inline">
            {formatTimestamp(entry.createdAt)}
          </span>

          <span className="text-muted-foreground/50 hidden shrink-0 text-[11px] sm:inline">
            {entry.recommendations.length} results
          </span>
        </div>
      </AccordionTrigger>

      <AccordionPanel className="px-4 pb-4">
        <div className="scrollbar-hidden space-y-4">
          <div className="scrollbar-hidden flex items-center gap-2 overflow-x-auto pb-1">
            <Button
              size="sm"
              variant="secondary"
              className="border-border h-8 shrink-0 gap-1.5 rounded-lg border text-xs shadow-none transition-[color,background-color,border-color,transform] hover:scale-[1.03] active:scale-[0.97]"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <ArrowUpRight className="size-3.5" />
              View Cards
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="border-border h-8 shrink-0 gap-1.5 rounded-lg border text-xs shadow-none transition-[color,background-color,border-color,transform] hover:scale-[1.03] active:scale-[0.97]"
              disabled={isGenerating}
              onClick={(e) => {
                e.stopPropagation();
                onGenerateAgain();
              }}
            >
              <RefreshCw
                className={cn("size-3.5", isGenerating && "animate-spin")}
              />
              Generate Again
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="border-border h-8 shrink-0 gap-1.5 rounded-lg border text-xs shadow-none transition-[color,background-color,border-color,transform] hover:scale-[1.03] active:scale-[0.97]"
              disabled={isGenerating}
              onClick={(e) => {
                e.stopPropagation();
                onGenerateMore();
              }}
            >
              <Plus className="size-3.5" />
              Generate More
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto h-8 shrink-0 gap-1.5 rounded-lg text-xs transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <Film className="size-3.5" />
              {movieCount} {movieCount === 1 ? "movie" : "movies"}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="flex items-center gap-1">
              <Tv className="size-3.5" />
              {tvCount} TV {tvCount === 1 ? "show" : "shows"}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span>
              Avg match:{" "}
              <span
                className={cn(
                  "font-semibold",
                  avgScore >= 80
                    ? "text-emerald-600 dark:text-emerald-400"
                    : avgScore >= 60
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground",
                )}
              >
                {avgScore}%
              </span>
            </span>
            {entry.inputStats.totalItems > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>
                  Based on {entry.inputStats.totalItems} watchlist{" "}
                  {entry.inputStats.totalItems === 1 ? "item" : "items"}
                </span>
              </>
            )}
            {entry.mediaTypePreference && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="capitalize">
                  {entry.mediaTypePreference === "movie"
                    ? "Movies only"
                    : "TV only"}
                </span>
              </>
            )}
          </div>

          {entry.genrePreference && (
            <div className="flex flex-wrap gap-1.5">
              {entry.genrePreference.split(", ").map((g) => (
                <Badge
                  key={g}
                  variant="secondary"
                  className="text-[10px] font-medium"
                >
                  {g}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
}
