import {
	ArrowUpRight,
	Clock,
	Film,
	Plus,
	RefreshCw,
	Trash2,
	Tv,
} from "lucide-react";
import { formatTimestamp } from "@/components/recommendations/recommendation-utils";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecommendationHistoryEntry } from "@/hooks/use-recommendations";
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
			<h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
				<Clock className="size-4" />
				History
			</h2>
			<Accordion type="single" collapsible className="space-y-2 mb-10">
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
				"rounded-2xl border border-border bg-card overflow-hidden transition-colors shadow-none",
				isActive && "ring-1 ring-border",
			)}
		>
			<AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-secondary/10 transition-colors [&[data-state=open]]:bg-secondary/10">
				<div className="flex flex-1 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-2">
					<Badge
						variant="outline"
						className="text-[10px] font-medium capitalize shrink-0"
					>
						{entry.generationType === "genre"
							? "Genre"
							: entry.generationType === "list"
								? "Custom List"
								: "Watchlist"}
					</Badge>

					<span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
						{entry.genrePreference
							? entry.genrePreference
							: `${entry.inputStats.movieCount} movies, ${entry.inputStats.tvCount} TV`}
						{entry.mediaTypePreference &&
							` · ${entry.mediaTypePreference === "movie" ? "Movies" : "TV"}`}
					</span>

					<div className="hidden sm:flex items-center gap-2 shrink-0 ml-auto">
						{movieCount > 0 && (
							<span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
								<Film className="size-3" />
								{movieCount}
							</span>
						)}
						{tvCount > 0 && (
							<span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
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

					<div className="flex w-full items-center gap-2 text-[11px] text-muted-foreground/60 sm:hidden">
						<span>{formatTimestamp(entry.createdAt)}</span>
						<span className="text-muted-foreground/40">·</span>
						<span>{entry.recommendations.length} results</span>
					</div>

					<span className="hidden text-[11px] text-muted-foreground/60 shrink-0 sm:inline">
						{formatTimestamp(entry.createdAt)}
					</span>

					<span className="hidden text-[11px] text-muted-foreground/50 shrink-0 sm:inline">
						{entry.recommendations.length} results
					</span>
				</div>
			</AccordionTrigger>

			<AccordionContent className="px-4 pb-4">
				<div className="space-y-4 scrollbar-hidden">
					<div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-hidden">
						<Button
							size="sm"
							variant="secondary"
							className="gap-1.5 text-xs h-8 shrink-0 rounded-lg border border-border hover:scale-[1.03] active:scale-[0.97] transition-[color,background-color,border-color,transform] shadow-none"
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
							className="gap-1.5 text-xs h-8 shrink-0 rounded-lg border border-border hover:scale-[1.03] active:scale-[0.97] transition-[color,background-color,border-color,transform] shadow-none"
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
							className="gap-1.5 text-xs h-8 shrink-0 rounded-lg border border-border hover:scale-[1.03] active:scale-[0.97] transition-[color,background-color,border-color,transform] shadow-none"
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
							className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto shrink-0 rounded-lg transition-colors"
							onClick={(e) => {
								e.stopPropagation();
								onDelete();
							}}
						>
							<Trash2 className="size-3.5" />
							Delete
						</Button>
					</div>

					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
			</AccordionContent>
		</AccordionItem>
	);
}
