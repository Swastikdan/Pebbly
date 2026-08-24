import { RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";

import type { MediaType } from "@/lib/media-types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENRE_LIST } from "@/constants";
import { cn } from "@/lib/utils";

export const POPULAR_GENRES = GENRE_LIST.slice(0, 14);

export const ERA_PRESETS = [
  { label: "Classics", from: 1900, to: 1979 },
  { label: "80s", from: 1980, to: 1989 },
  { label: "90s", from: 1990, to: 1999 },
  { label: "2000s", from: 2000, to: 2009 },
  { label: "2010s", from: 2010, to: 2019 },
  { label: "2020s", from: 2020, to: 2029 },
] as const;

export const COUNT_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

export type GenMode = "watchlist" | "genre" | "list";

export function RecommendationFilters({
  genMode,
  setGenMode,
  listId,
  setListId,
  mediaType,
  setMediaType,
  selectedGenres,
  toggleGenre,
  selectedEras,
  toggleEra,
  count,
  setCount,
  showAdvancedOptions,
  setShowAdvancedOptions,
  customLists,
  watchlist,
  watchlistLoading,
  isGenerating,
  handleGenerate,
}: {
  genMode: GenMode;
  setGenMode: (mode: GenMode) => void;
  listId: string;
  setListId: (id: string) => void;
  mediaType: MediaType | undefined;
  setMediaType: (mediaType: MediaType | undefined) => void;
  selectedGenres: string[];
  toggleGenre: (name: string) => void;
  selectedEras: string[];
  toggleEra: (label: string) => void;
  count: number;
  setCount: (count: number) => void;
  showAdvancedOptions: boolean;
  setShowAdvancedOptions: (
    show: boolean | ((prev: boolean) => boolean),
  ) => void;
  customLists: Array<{ id: string; name: string }>;
  watchlist: unknown[];
  watchlistLoading: boolean;
  isGenerating: boolean;
  handleGenerate: () => void;
}) {
  const genModeItems = [
    { value: "watchlist", label: "From Watchlist" },
    ...customLists.map((list) => ({
      value: `list:${list.id}`,
      label: `From List: ${list.name}`,
    })),
    { value: "genre", label: "By Genre" },
  ];

  return (
    <div className="border-border bg-card rounded-[calc(var(--radius-2xl)+4px)] border p-3">
      <div className="space-y-3">
        <div className="flex flex-col flex-wrap items-start gap-2 sm:flex-row sm:items-center">
          <Select
            items={genModeItems}
            value={genMode === "list" ? `list:${listId}` : genMode}
            onValueChange={(val: string | null) => {
              if (!val) return;
              if (val.startsWith("list:")) {
                setGenMode("list");
                setListId(val.replace("list:", ""));
              } else {
                setGenMode(val as "watchlist" | "genre");
                setListId("");
              }
            }}
          >
            <SelectTrigger className="text-foreground bg-secondary/20 border-border hover:bg-secondary/40 h-10 w-auto rounded-xl border px-4 text-xs font-semibold shadow-none transition-colors">
              <SelectValue placeholder="From Watchlist" />
            </SelectTrigger>
            <SelectPopup
              align="start"
              className="max-h-[300px] overflow-y-auto"
            >
              <SelectItem value="watchlist" className="text-xs">
                From Watchlist
              </SelectItem>
              {customLists.map((list) => (
                <SelectItem
                  key={list.id}
                  value={`list:${list.id}`}
                  className="text-xs"
                >
                  From List: {list.name}
                </SelectItem>
              ))}
              <SelectItem value="genre" className="mt-1 border-t pt-1 text-xs">
                By Genre
              </SelectItem>
            </SelectPopup>
          </Select>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="bg-secondary/20 border-border flex h-10 flex-1 items-center gap-1 rounded-xl border p-1 sm:flex-none">
              <Button
                className="h-8 flex-1 rounded-lg px-4 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 sm:flex-none"
                variant={!mediaType ? "default" : "ghost"}
                onClick={() => setMediaType(undefined)}
              >
                All
              </Button>
              <Button
                className="h-8 flex-1 rounded-lg px-4 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 sm:flex-none"
                variant={mediaType === "movie" ? "default" : "ghost"}
                onClick={() =>
                  setMediaType(mediaType === "movie" ? undefined : "movie")
                }
              >
                Movies
              </Button>
              <Button
                className="h-8 flex-1 rounded-lg px-4 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 sm:flex-none"
                variant={mediaType === "tv" ? "default" : "ghost"}
                onClick={() =>
                  setMediaType(mediaType === "tv" ? undefined : "tv")
                }
              >
                TV Shows
              </Button>
            </div>

            <Button
              type="button"
              variant={showAdvancedOptions ? "outline" : "ghost"}
              className="border-border bg-card/40 hover:bg-secondary/40 h-10 w-10 shrink-0 justify-center gap-1.5 rounded-xl border text-xs shadow-none transition-colors"
              onClick={() => setShowAdvancedOptions((prev) => !prev)}
            >
              <SlidersHorizontal className="size-3.5" />
            </Button>
          </div>
          <div className="mt-1 flex w-full sm:mt-0 sm:ml-auto sm:w-auto">
            <Button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                (genMode === "watchlist" &&
                  !watchlistLoading &&
                  watchlist.length === 0) ||
                (genMode === "list" && !listId)
              }
              variant="secondary"
              className="border-border h-10 w-full gap-2 rounded-xl border px-5 shadow-none transition-[color,background-color,border-color,transform] duration-150 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
            >
              {isGenerating ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>

        {showAdvancedOptions && (
          <div className="border-border/40 mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-4">
            <div className="scrollbar-hidden flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-muted-foreground mr-1 shrink-0 text-xs font-medium">
                Era
              </span>
              {ERA_PRESETS.map((era) => (
                <Button
                  key={era.label}
                  type="button"
                  variant={
                    selectedEras.includes(era.label) ? "default" : "ghost"
                  }
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150",
                    selectedEras.includes(era.label)
                      ? "bg-primary text-primary-foreground border-transparent hover:scale-105"
                      : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60 hover:text-foreground border",
                  )}
                  onClick={() => toggleEra(era.label)}
                >
                  {era.label}
                </Button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-muted-foreground mr-1 shrink-0 text-xs font-medium">
                Count
              </span>
              <Select
                items={COUNT_OPTIONS.map((c) => ({
                  value: String(c),
                  label: String(c),
                }))}
                value={String(count)}
                onValueChange={(v) => setCount(Number(v))}
              >
                <SelectTrigger
                  size="sm"
                  className="bg-secondary/40 border-border hover:bg-secondary/60 h-8 w-[70px] shrink-0 rounded-lg border px-2.5 text-xs font-semibold shadow-none transition-colors"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup className="min-w-[4rem]">
                  {COUNT_OPTIONS.map((c) => (
                    <SelectItem key={c} value={String(c)} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>
        )}

        {genMode === "watchlist" &&
          !watchlistLoading &&
          watchlist.length === 0 && (
            <p className="text-muted-foreground animate-in fade-in slide-in-from-top-1 text-[13px]">
              Your watchlist is empty. Add some titles first or try generating{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => setGenMode("genre")}
                className="text-foreground h-auto p-0 underline underline-offset-2"
              >
                By Genre
              </Button>
              .
            </p>
          )}

        {genMode === "genre" && (
          <div className="border-border/40 mt-3 flex flex-wrap gap-2 border-t pt-4">
            {POPULAR_GENRES.map((genre) => (
              <Button
                key={genre.id}
                type="button"
                variant={
                  selectedGenres.includes(genre.name) ? "default" : "ghost"
                }
                className={cn(
                  "h-8 rounded-lg px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150",
                  selectedGenres.includes(genre.name)
                    ? "bg-primary text-primary-foreground border-transparent hover:scale-105"
                    : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60 hover:text-foreground border",
                )}
                onClick={() => toggleGenre(genre.name)}
              >
                {genre.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
