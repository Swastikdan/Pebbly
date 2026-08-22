import { RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectItem,
	SelectPopup,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { GENRE_LIST } from "@/constants";
import type { MediaType } from "@/lib/media-types";
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
		<div className="rounded-[calc(var(--radius-2xl)+4px)] border border-border bg-card p-3">
			<div className="space-y-3">
				<div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2">
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
						<SelectTrigger className="h-10 w-auto px-4 text-xs font-semibold text-foreground bg-secondary/20 border border-border rounded-xl hover:bg-secondary/40 transition-colors shadow-none">
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
							<SelectItem value="genre" className="text-xs border-t mt-1 pt-1">
								By Genre
							</SelectItem>
						</SelectPopup>
					</Select>

					<div className="w-full sm:w-auto flex items-center gap-2">
						<div className="flex flex-1 sm:flex-none gap-1 rounded-xl bg-secondary/20 p-1 h-10 items-center border border-border">
							<Button
								className="h-8 px-4 text-xs font-semibold rounded-lg flex-1 sm:flex-none transition-[color,background-color,border-color,transform] duration-150"
								variant={!mediaType ? "default" : "ghost"}
								onClick={() => setMediaType(undefined)}
							>
								All
							</Button>
							<Button
								className="h-8 px-4 text-xs font-semibold rounded-lg flex-1 sm:flex-none transition-[color,background-color,border-color,transform] duration-150"
								variant={mediaType === "movie" ? "default" : "ghost"}
								onClick={() =>
									setMediaType(mediaType === "movie" ? undefined : "movie")
								}
							>
								Movies
							</Button>
							<Button
								className="h-8 px-4 text-xs font-semibold rounded-lg flex-1 sm:flex-none transition-[color,background-color,border-color,transform] duration-150"
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
							className="gap-1.5 h-10 w-10 text-xs justify-center shrink-0 rounded-xl border border-border bg-card/40 hover:bg-secondary/40 transition-colors shadow-none"
							onClick={() => setShowAdvancedOptions((prev) => !prev)}
						>
							<SlidersHorizontal className="size-3.5" />
						</Button>
					</div>
					<div className="w-full sm:w-auto sm:ml-auto mt-1 sm:mt-0 flex">
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
							className="gap-2 h-10 w-full sm:w-auto rounded-xl px-5 border border-border hover:scale-[1.02] active:scale-[0.98] transition-[color,background-color,border-color,transform] duration-150 shadow-none"
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
					<div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/40 pt-4 mt-3">
						<div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden pb-0.5">
							<span className="text-xs text-muted-foreground font-medium shrink-0 mr-1">
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
										"h-8 rounded-lg px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 shrink-0",
										selectedEras.includes(era.label)
											? "bg-primary text-primary-foreground border-transparent hover:scale-105"
											: "bg-secondary/40 text-muted-foreground border border-border hover:bg-secondary/60 hover:text-foreground",
									)}
									onClick={() => toggleEra(era.label)}
								>
									{era.label}
								</Button>
							))}
						</div>

						<div className="flex items-center gap-1.5 shrink-0">
							<span className="text-xs text-muted-foreground font-medium shrink-0 mr-1">
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
									className="h-8 w-[70px] text-xs font-semibold px-2.5 bg-secondary/40 border border-border rounded-lg shrink-0 hover:bg-secondary/60 transition-colors shadow-none"
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
						<p className="text-[13px] text-muted-foreground animate-in fade-in slide-in-from-top-1">
							Your watchlist is empty. Add some titles first or try generating{" "}
							<Button
								type="button"
								variant="link"
								onClick={() => setGenMode("genre")}
								className="h-auto p-0 text-foreground underline underline-offset-2"
							>
								By Genre
							</Button>
							.
						</p>
					)}

				{genMode === "genre" && (
					<div className="flex flex-wrap gap-2 border-t border-border/40 pt-4 mt-3">
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
										: "bg-secondary/40 text-muted-foreground border border-border hover:bg-secondary/60 hover:text-foreground",
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
