import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import {
	ArrowUpRight,
	Clock,
	Film,
	Plus,
	RefreshCw,
	SlidersHorizontal,
	Sparkles,
	Trash2,
	Tv,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { GENRE_LIST, HORIZONTAL_MEDIA_GRID_CLASS } from "@/constants";
import type {
	GenerateOptions,
	RecommendationHistoryEntry,
} from "@/hooks/useRecommendations";
import {
	useRecommendationAccess,
	useRecommendations,
} from "@/hooks/useRecommendations";
import { useWatchlist } from "@/hooks/usewatchlist";
import {
	getBasicMovieDetails,
	getBasicTvDetails,
	getSearchResult,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { AIRecommendation, BasicMovie, BasicTv } from "@/types";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/recommendations")({
	head: () => ({
		meta: [
			{ title: "AI Recommendations | Film Fanatic" },
			{
				name: "description",
				content:
					"AI-powered movie and TV show recommendations based on your watchlist.",
			},
		],
	}),
	component: RecommendationsPage,
});

// ─── TMDB Helpers ───────────────────────────────────────────────────

interface NormalizedTmdbData {
	id: number;
	title: string;
	posterPath: string | null;
	rating: number;
	releaseDate: string | null;
	overview: string;
}

function normalizeTmdbData(
	data: BasicMovie | BasicTv | null | undefined,
	mediaType: "movie" | "tv",
): NormalizedTmdbData | null {
	if (!data) return null;
	if (mediaType === "movie") {
		const m = data as BasicMovie;
		return {
			id: m.id,
			title: m.title,
			posterPath: m.poster_path || null,
			rating: m.vote_average,
			releaseDate: m.release_date || null,
			overview: m.overview,
		};
	}
	const t = data as BasicTv;
	return {
		id: t.id,
		title: t.name,
		posterPath: t.poster_path || null,
		rating: t.vote_average,
		releaseDate: t.first_air_date || null,
		overview: t.overview,
	};
}

function titlesMatch(aiTitle: string, tmdbTitle: string): boolean {
	const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
	const a = normalize(aiTitle);
	const b = normalize(tmdbTitle);
	return a === b || a.includes(b) || b.includes(a);
}

function useTmdbData(tmdbId: number | null, mediaType: "movie" | "tv") {
	const movieResult = useQuery({
		queryKey: ["basic_movie_details", tmdbId],
		queryFn: () => getBasicMovieDetails({ id: tmdbId as number }),
		enabled: !!tmdbId && mediaType === "movie",
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const tvResult = useQuery({
		queryKey: ["basic_tv_details", tmdbId],
		queryFn: () => getBasicTvDetails({ id: tmdbId as number }),
		enabled: !!tmdbId && mediaType === "tv",
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (!tmdbId) return { data: null, isLoading: false, exists: false };

	const result = mediaType === "movie" ? movieResult : tvResult;
	return {
		data: normalizeTmdbData(result.data, mediaType),
		isLoading: result.isLoading,
		exists: !!result.data && !result.isError,
	};
}

/** Search TMDB by title when ID-based lookup fails. */
function useTmdbSearchFallback(
	title: string,
	mediaType: "movie" | "tv",
	shouldSearch: boolean,
) {
	const searchResult = useQuery({
		queryKey: ["tmdb_search_fallback", title, mediaType],
		queryFn: async () => {
			const results = await getSearchResult(title, 1);
			const filtered = (results.results ?? []).filter(
				(r) => r.media_type === mediaType,
			);
			if (filtered.length === 0) return null;
			const first = filtered[0];
			const resultTitle =
				mediaType === "movie"
					? (first.title ?? first.name ?? "")
					: (first.name ?? first.title ?? "");

			// Reject if title doesn't match
			if (!titlesMatch(title, resultTitle)) return null;

			// Reject low-quality results: no rating, no poster, or empty title
			const rating = first.vote_average ?? 0;
			if (rating === 0 || !first.poster_path || !resultTitle) return null;

			return {
				id: first.id,
				title: resultTitle,
				posterPath: first.poster_path ?? null,
				rating,
				releaseDate:
					mediaType === "movie"
						? (first.release_date ?? null)
						: (first.first_air_date ?? null),
				overview: first.overview ?? "",
			} as NormalizedTmdbData;
		},
		enabled: shouldSearch,
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	return {
		data: searchResult.data ?? null,
		isLoading: searchResult.isLoading && shouldSearch,
		exists: !!searchResult.data,
	};
}

function getScoreColor(score: number) {
	if (score >= 80) return "bg-green-100/90 text-green-600";
	if (score >= 60) return "bg-yellow-100/90 text-yellow-600";
	return "bg-secondary text-muted-foreground";
}

function formatTimestamp(ts: number) {
	return new Date(ts).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// ─── Page ───────────────────────────────────────────────────────────

function RecommendationsPage() {
	const {
		hasAccess,
		loading: accessLoading,
		isSignedIn,
	} = useRecommendationAccess();

	if (accessLoading) {
		return <DefaultLoader />;
	}

	if (!isSignedIn || !hasAccess) {
		return <DefaultNotFoundComponent />;
	}

	return (
		<PageShell>
			<RecommendationsContent isSignedIn={isSignedIn} />
		</PageShell>
	);
}

function PageShell({ children }: { children: React.ReactNode }) {
	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
				<div className="mb-6 flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
				</div>
				<h1 className="mb-6 text-2xl font-bold">AI Recommendations</h1>
				{children}
			</div>
		</section>
	);
}

// ─── Content ────────────────────────────────────────────────────────

const POPULAR_GENRES = GENRE_LIST.slice(0, 14);

const ERA_PRESETS = [
	{ label: "Classics", from: 1900, to: 1979 },
	{ label: "80s", from: 1980, to: 1989 },
	{ label: "90s", from: 1990, to: 1999 },
	{ label: "2000s", from: 2000, to: 2009 },
	{ label: "2010s", from: 2010, to: 2019 },
	{ label: "2020s", from: 2020, to: 2029 },
] as const;

const COUNT_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

function RecommendationsContent({ isSignedIn }: { isSignedIn: boolean }) {
	const {
		history,
		isGenerating,
		error,
		generate,
		deleteEntry,
		updateVerified,
	} = useRecommendations();

	const { watchlist, loading: watchlistLoading } = useWatchlist();

	const [activeId, setActiveId] = useState<string | null>(null);
	const [genMode, setGenMode] = useState<"watchlist" | "genre" | "list">(
		"watchlist",
	);
	const [listId, setListId] = useState<string>("");
	const [mediaType, setMediaType] = useState<"movie" | "tv" | undefined>();
	const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
	const [selectedEras, setSelectedEras] = useState<string[]>([]);
	const [count, setCount] = useState(10);
	const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

	const toggleGenre = (name: string) => {
		setSelectedGenres((prev) =>
			prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
		);
	};

	const toggleEra = (label: string) => {
		setSelectedEras((prev) =>
			prev.includes(label) ? prev.filter((e) => e !== label) : [...prev, label],
		);
	};

	const customListsResult = useConvexQuery(
		api.watchlist.getCustomLists,
		isSignedIn ? {} : "skip",
	);
	const customLists = customListsResult ?? [];

	const handleGenerate = () => {
		if (genMode === "watchlist" && watchlist.length === 0) return;
		if (genMode === "list" && !listId) return;

		const options: GenerateOptions = { generationType: genMode };
		if (genMode === "list") options.listId = listId;

		if (mediaType) options.mediaTypePreference = mediaType;
		if (genMode === "genre" && selectedGenres.length > 0)
			options.genrePreference = selectedGenres.join(", ");

		// Compute year range from selected eras
		if (selectedEras.length > 0) {
			const matchedEras = ERA_PRESETS.filter((e) =>
				selectedEras.includes(e.label),
			);
			options.yearFrom = Math.min(...matchedEras.map((e) => e.from));
			options.yearTo = Math.max(...matchedEras.map((e) => e.to));
		}

		options.count = count;
		generate(options);
		setActiveId(null);
	};

	const handleGenerateAgain = (entry: RecommendationHistoryEntry) => {
		const options: GenerateOptions = {
			generationType: entry.generationType || "watchlist",
		};
		// Assume list recommendations don't have a specific `listId` saved yet, but we'll try to keep generationType.
		if (entry.mediaTypePreference)
			options.mediaTypePreference = entry.mediaTypePreference as "movie" | "tv";
		if (entry.genrePreference) options.genrePreference = entry.genrePreference;
		generate(options);
		setActiveId(null);
	};

	const handleGenerateMore = (entry: RecommendationHistoryEntry) => {
		const options: GenerateOptions = {
			generationType: entry.generationType || "watchlist",
		};
		if (entry.mediaTypePreference)
			options.mediaTypePreference = entry.mediaTypePreference as "movie" | "tv";
		if (entry.genrePreference) options.genrePreference = entry.genrePreference;

		// Exclude previously recommended items from this specific entry to avoid duplicates
		options.excludeTmdbIds = entry.recommendations
			.map((r) => r.tmdbId)
			.filter((id): id is number => id !== null);

		generate(options);
		setActiveId(null);
	};

	const handleDelete = async (id: string) => {
		await deleteEntry(id);
		if (activeId === id) setActiveId(null);
	};

	// Active entry: if activeId is set, find it; otherwise show the newest
	const activeEntry =
		(activeId ? history.find((h) => h._id === activeId) : null) ??
		history[0] ??
		null;

	const errorMessages: Record<string, string> = {
		empty_watchlist:
			"Add some movies or TV shows to your watchlist first to get recommendations.",
		api_unavailable:
			"The AI service is temporarily unavailable. Please try again later.",
		invalid_response:
			"The AI returned an unexpected response. Please try again.",
		rate_limited:
			"Please wait a couple minutes before generating new recommendations.",
		high_demand:
			"The AI model is currently experiencing high demand. Please try again later.",
	};

	return (
		<div className="space-y-8">
			{/* ── Generation Controls ─────────────────────────── */}
			<div className="space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<div className="order-1 flex gap-0.5 rounded-lg bg-secondary/40 p-0.5 h-9 items-center ring-1 ring-border/40">
						<Select
							value={genMode === "list" ? `list:${listId}` : genMode}
							onValueChange={(val: string) => {
								if (val.startsWith("list:")) {
									setGenMode("list");
									setListId(val.replace("list:", ""));
								} else {
									setGenMode(val as "watchlist" | "genre");
									setListId("");
								}
							}}
						>
							<SelectTrigger className="h-8 w-auto px-4 text-xs font-semibold bg-transparent border-0 ring-0 focus:ring-0 shadow-none">
								<SelectValue placeholder="From Watchlist" />
							</SelectTrigger>
							<SelectContent position="popper" align="start">
								<SelectItem value="watchlist" className="text-xs">
									From Watchlist
								</SelectItem>
								{customLists.map((list) => (
									<SelectItem
										key={list._id}
										value={`list:${list._id}`}
										className="text-xs"
									>
										From List: {list.name}
									</SelectItem>
								))}
								<SelectItem
									value="genre"
									className="text-xs border-t mt-1 pt-1"
								>
									By Genre
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="order-3 w-full sm:w-auto flex gap-0.5 rounded-lg bg-secondary/40 p-0.5 h-9 items-center ring-1 ring-border/40">
						<Button
							className="h-8 px-3 text-xs font-semibold rounded-md"
							variant={!mediaType ? "default" : "ghost"}
							onClick={() => setMediaType(undefined)}
						>
							All
						</Button>
						<Button
							className="h-8 px-3 text-xs font-semibold rounded-md"
							variant={mediaType === "movie" ? "default" : "ghost"}
							onClick={() =>
								setMediaType(mediaType === "movie" ? undefined : "movie")
							}
						>
							Movies
						</Button>
						<Button
							className="h-8 px-3 text-xs font-semibold rounded-md"
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
						variant={showAdvancedOptions ? "default" : "ghost"}
						className="order-4 gap-1.5 h-9 w-[132px] text-xs justify-center"
						onClick={() => setShowAdvancedOptions((prev) => !prev)}
					>
						<SlidersHorizontal className="size-3.5" />
						<span className="relative inline-flex w-[72px] justify-center">
							<span
								className={cn(
									"absolute inset-0 transition-opacity",
									showAdvancedOptions ? "opacity-100" : "opacity-0",
								)}
							>
								Simple
							</span>
							<span
								className={cn(
									"absolute inset-0 transition-opacity",
									showAdvancedOptions ? "opacity-0" : "opacity-100",
								)}
							>
								Full options
							</span>
							<span className="invisible">Full options</span>
						</span>
					</Button>

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
						className="order-2 sm:order-none ml-auto gap-2 h-9"
					>
						{isGenerating ? (
							<RefreshCw className="size-4 animate-spin" />
						) : (
							<Sparkles className="size-4 text-blue-500 fill-blue-500/20" />
						)}
						{isGenerating ? "Generating..." : "Generate"}
					</Button>
				</div>

				{/* Row 2: Era chips and Count dropdown */}
				{showAdvancedOptions && (
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden pb-0.5">
							<span className="text-xs text-muted-foreground font-medium shrink-0 mr-1">
								Era
							</span>
							{ERA_PRESETS.map((era) => (
								<button
									key={era.label}
									type="button"
									className={cn(
										"rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
										selectedEras.includes(era.label)
											? "bg-foreground text-background"
											: "bg-secondary/60 text-muted-foreground hover:bg-secondary",
									)}
									onClick={() => toggleEra(era.label)}
								>
									{era.label}
								</button>
							))}
						</div>

						{/* Count — shadcn Select */}
						<div className="flex items-center gap-1.5 shrink-0">
							<span className="text-xs text-muted-foreground font-medium shrink-0 mr-1">
								Count
							</span>
							<Select
								value={String(count)}
								onValueChange={(v) => setCount(Number(v))}
							>
								<SelectTrigger className="h-8 w-[60px] text-xs font-semibold px-2 bg-secondary/60 border-0 ring-1 ring-border/40 shrink-0">
									<SelectValue />
								</SelectTrigger>
								<SelectContent position="popper" className="min-w-[4rem]">
									{COUNT_OPTIONS.map((c) => (
										<SelectItem key={c} value={String(c)} className="text-xs">
											{c}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				)}

				{/* Row 3: Genres (conditionally visible) */}
				{genMode === "watchlist" &&
					!watchlistLoading &&
					watchlist.length === 0 && (
						<p className="text-[13px] text-muted-foreground animate-in fade-in slide-in-from-top-1">
							Your watchlist is empty. Add some titles first or try generating{" "}
							<button
								type="button"
								onClick={() => setGenMode("genre")}
								className="text-foreground underline underline-offset-2"
							>
								By Genre
							</button>
							.
						</p>
					)}

				{/* Genre chips — only visible in "By Genre" mode */}
				{genMode === "genre" && (
					<div className="flex flex-wrap gap-1.5">
						{POPULAR_GENRES.map((genre) => (
							<button
								key={genre.id}
								type="button"
								className={cn(
									"rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
									selectedGenres.includes(genre.name)
										? "bg-foreground text-background"
										: "bg-secondary/60 text-muted-foreground hover:bg-secondary",
								)}
								onClick={() => toggleGenre(genre.name)}
							>
								{genre.name}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Error */}
			{error && (
				<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
					{errorMessages[error as string] ?? error}
				</div>
			)}

			{/* Loading */}
			{isGenerating && <LoadingSkeletons />}

			{/* ── Active Recommendations ─────────────────────── */}
			{!isGenerating && activeEntry && (
				<div className="space-y-3">
					{/* Active entry metadata */}
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						<Badge
							variant="outline"
							className="text-[10px] font-medium capitalize"
						>
							{activeEntry.generationType === "genre"
								? "By Genre"
								: activeEntry.generationType === "list"
									? "Custom List"
									: "Watchlist"}
						</Badge>
						{activeEntry.genrePreference && (
							<span>{activeEntry.genrePreference}</span>
						)}
						{activeEntry.mediaTypePreference && (
							<span className="capitalize">
								{activeEntry.mediaTypePreference === "movie"
									? "Movies only"
									: "TV only"}
							</span>
						)}
						<span>
							{activeEntry.inputStats.movieCount} movies,{" "}
							{activeEntry.inputStats.tvCount} TV shows
						</span>
						<span>{formatTimestamp(activeEntry.createdAt)}</span>
					</div>

					{/* Cards grid */}
					<RecommendationCardGrid
						entry={activeEntry}
						updateVerified={updateVerified}
					/>
				</div>
			)}

			{/* Empty state */}
			{!isGenerating && history.length === 0 && (
				<div className="flex flex-col items-center justify-center gap-4 py-20">
					<Sparkles className="size-10 text-muted-foreground/40" />
					<p className="text-sm text-muted-foreground text-center max-w-sm">
						Generate your first recommendations using your watchlist or by
						selecting genres above.
					</p>
				</div>
			)}

			{/* ── History (Accordion) ────────────────────────── */}
			{history.length > 0 && (
				<div className="space-y-3">
					<h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
						<Clock className="size-4" />
						History
					</h2>
					<Accordion type="single" collapsible className="space-y-2 mb-10">
						{history.map((entry) => (
							<HistoryAccordionItem
								key={entry._id}
								entry={entry}
								isActive={entry._id === activeEntry?._id}
								onSelect={() => setActiveId(entry._id)}
								onDelete={() => handleDelete(entry._id)}
								onGenerateAgain={() => handleGenerateAgain(entry)}
								onGenerateMore={() => handleGenerateMore(entry)}
								isGenerating={isGenerating}
							/>
						))}
					</Accordion>
				</div>
			)}
		</div>
	);
}

// ─── History Accordion Item ─────────────────────────────────────────

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
			value={entry._id}
			className={cn(
				"rounded-xl border border-border/40 bg-card overflow-hidden transition-colors",
				isActive && "ring-1 ring-border/60",
			)}
		>
			<AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-secondary/10 transition-colors [&[data-state=open]]:bg-secondary/10">
				<div className="flex flex-1 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-2">
					{/* Type badge */}
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

					{/* Description */}
					<span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
						{entry.genrePreference
							? entry.genrePreference
							: `${entry.inputStats.movieCount} movies, ${entry.inputStats.tvCount} TV`}
						{entry.mediaTypePreference &&
							` · ${entry.mediaTypePreference === "movie" ? "Movies" : "TV"}`}
					</span>

					{/* Stats */}
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
						<Badge
							className={cn(
								"text-[9px] tabular-nums font-semibold",
								getScoreColor(avgScore),
							)}
						>
							{avgScore}%
						</Badge>
					</div>

					<div className="flex w-full items-center gap-2 text-[11px] text-muted-foreground/60 sm:hidden">
						<span>{formatTimestamp(entry.createdAt)}</span>
						<span className="text-muted-foreground/40">·</span>
						<span>{entry.recommendations.length} results</span>
					</div>

					{/* Timestamp */}
					<span className="hidden text-[11px] text-muted-foreground/60 shrink-0 sm:inline">
						{formatTimestamp(entry.createdAt)}
					</span>

					{/* Result count */}
					<span className="hidden text-[11px] text-muted-foreground/50 shrink-0 sm:inline">
						{entry.recommendations.length} results
					</span>
				</div>
			</AccordionTrigger>

			<AccordionContent className="px-4 pb-4">
				{/* Expanded details */}
				<div className="space-y-4 scrollbar-hidden">
					{/* Actions */}
					<div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-hidden">
						<Button
							size="sm"
							variant="secondary"
							className="gap-1.5 text-xs h-8 shrink-0"
							onClick={(e) => {
								e.stopPropagation();
								onSelect();
								// scroll to top
								window.scrollTo({ top: 0, behavior: "smooth" });
							}}
						>
							<ArrowUpRight className="size-3.5" />
							View Cards
						</Button>
						<Button
							size="sm"
							variant="secondary"
							className="gap-1.5 text-xs h-8 shrink-0"
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
							className="gap-1.5 text-xs h-8 shrink-0"
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
							className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto shrink-0"
							onClick={(e) => {
								e.stopPropagation();
								onDelete();
							}}
						>
							<Trash2 className="size-3.5" />
							Delete
						</Button>
					</div>

					{/* Stats row */}
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
							Avg relevance:{" "}
							<span
								className={cn(
									"font-semibold",
									avgScore >= 80
										? "text-green-600 dark:text-green-400"
										: avgScore >= 60
											? "text-yellow-600 dark:text-yellow-400"
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

					{/* Generation params */}
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

// ─── Recommendation Card Grid (with verification) ───────────────────

function RecommendationCardGrid({
	entry,
	updateVerified,
}: {
	entry: RecommendationHistoryEntry;
	updateVerified: (id: string, recs: AIRecommendation[]) => Promise<void>;
}) {
	const verifiedMapRef = useRef<Map<number, AIRecommendation>>(new Map());
	const totalCount = entry.recommendations.length;
	const resolvedCountRef = useRef(0);
	const hasPushedRef = useRef(false);

	const entryId = entry._id;

	// Reset refs when entry changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: entryId is intentionally used to reset refs when the entry changes
	useEffect(() => {
		verifiedMapRef.current = new Map();
		resolvedCountRef.current = 0;
		hasPushedRef.current = false;
	}, [entryId]);

	const onCardResolved = useCallback(
		(index: number, verifiedRec: AIRecommendation) => {
			verifiedMapRef.current.set(index, verifiedRec);
			resolvedCountRef.current += 1;

			// Once all cards have resolved, push verified data to backend
			if (
				!hasPushedRef.current &&
				!entry.verified &&
				resolvedCountRef.current >= totalCount
			) {
				hasPushedRef.current = true;

				// Only push if at least one card was truly verified
				const hasAnyVerified = Array.from(verifiedMapRef.current.values()).some(
					(r) => !!r.verifiedTmdbId,
				);

				if (hasAnyVerified) {
					const updatedRecs = entry.recommendations.map((rec, i) => {
						const verified = verifiedMapRef.current.get(i);
						// Only replace if this specific card was verified
						if (verified?.verifiedTmdbId) return verified;
						// Otherwise keep original data untouched
						return rec;
					});
					updateVerified(entryId, updatedRecs);
				}
			}
		},
		[
			entryId,
			entry.verified,
			entry.recommendations,
			totalCount,
			updateVerified,
		],
	);

	return (
		<div className={`stagger-grid ${HORIZONTAL_MEDIA_GRID_CLASS}`}>
			{entry.recommendations.map((rec, i) => (
				<RecommendationCard
					key={`${rec.tmdbId ?? rec.title}-${i}`}
					recommendation={rec}
					isEntryVerified={!!entry.verified}
					onResolved={(verifiedRec) => onCardResolved(i, verifiedRec)}
				/>
			))}
		</div>
	);
}

// ─── Recommendation Card ────────────────────────────────────────────

function RecommendationCard({
	recommendation,
	isEntryVerified,
	onResolved,
}: {
	recommendation: AIRecommendation;
	isEntryVerified: boolean;
	onResolved?: (verifiedRec: AIRecommendation) => void;
}) {
	const { title, tmdbId, mediaType, relevanceScore, reasoning } =
		recommendation;
	const navigate = useNavigate();
	const hasReportedRef = useRef(false);

	// Whether we can skip all TMDB lookups (already verified + have cached data)
	const usesCachedData = isEntryVerified && !!recommendation.verifiedTmdbId;

	// ── Always call hooks (disabled via flags when not needed) ──
	const {
		data: tmdbData,
		isLoading: idLoading,
		exists: idExists,
	} = useTmdbData(usesCachedData ? null : tmdbId, mediaType);

	const idVerified =
		!usesCachedData &&
		tmdbData &&
		idExists &&
		titlesMatch(title, tmdbData.title) &&
		tmdbData.rating > 0 &&
		!!tmdbData.posterPath;
	const idResolved = usesCachedData || !tmdbId || !idLoading;

	const shouldSearch = !usesCachedData && idResolved && !idVerified;
	const {
		data: searchData,
		isLoading: searchLoading,
		exists: searchExists,
	} = useTmdbSearchFallback(title, mediaType, shouldSearch);

	// ── Determine final resolved data ──
	const resolvedData = usesCachedData
		? null // won't be used — short-circuit below
		: idVerified
			? tmdbData
			: searchExists
				? searchData
				: null;

	const isStillLoading =
		!usesCachedData &&
		((!!tmdbId && idLoading) || (shouldSearch && searchLoading));

	// Report resolution to parent (for verification tracking)
	useEffect(() => {
		if (usesCachedData || hasReportedRef.current || isStillLoading) return;
		hasReportedRef.current = true;

		if (resolvedData && onResolved) {
			onResolved({
				...recommendation,
				verifiedTmdbId: resolvedData.id,
				verifiedTitle: resolvedData.title,
				posterPath: resolvedData.posterPath,
				rating: resolvedData.rating,
				releaseDate: resolvedData.releaseDate,
				overview: resolvedData.overview,
			});
		} else if (onResolved) {
			// Unverified — report original so batch doesn't stall
			onResolved(recommendation);
		}
	}, [
		usesCachedData,
		isStillLoading,
		resolvedData,
		recommendation,
		onResolved,
	]);

	// ── Cached verified data: render immediately ──
	if (usesCachedData) {
		return (
			<div className="relative">
				<div className="absolute top-2 left-2 z-20">
					<Badge
						className={cn(
							"tabular-nums font-semibold text-[10px]",
							getScoreColor(relevanceScore),
						)}
					>
						{relevanceScore}%
					</Badge>
				</div>
				<MediaCard
					card_type="horizontal"
					id={recommendation.verifiedTmdbId as number}
					title={recommendation.verifiedTitle ?? title}
					rating={recommendation.rating ?? 0}
					image={recommendation.posterPath ?? ""}
					poster_path={recommendation.posterPath ?? ""}
					media_type={mediaType}
					release_date={recommendation.releaseDate ?? null}
					overview={recommendation.overview ?? ""}
				/>
			</div>
		);
	}

	if (isStillLoading) {
		return <MediaCardSkeleton card_type="horizontal" />;
	}

	// ── Verified card ──
	if (resolvedData) {
		return (
			<div className="relative">
				<div className="absolute top-2 left-2 z-20">
					<Badge
						className={cn(
							"tabular-nums font-semibold text-[10px]",
							getScoreColor(relevanceScore),
						)}
					>
						{relevanceScore}%
					</Badge>
				</div>
				<MediaCard
					card_type="horizontal"
					id={resolvedData.id}
					title={resolvedData.title}
					rating={resolvedData.rating}
					image={resolvedData.posterPath ?? ""}
					poster_path={resolvedData.posterPath ?? ""}
					media_type={mediaType}
					release_date={resolvedData.releaseDate}
					overview={resolvedData.overview}
				/>
			</div>
		);
	}

	// ── Fallback card — could not be verified ──
	return (
		<div className="group/card w-40 md:w-44 lg:w-48">
			<button
				type="button"
				className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border/40 text-left cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] "
				onClick={() => navigate({ to: "/search", search: { query: title } })}
			>
				{/* Top badges */}
				<div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between p-2.5">
					<Badge
						className={cn(
							"tabular-nums font-semibold text-[10px]",
							getScoreColor(relevanceScore),
						)}
					>
						{relevanceScore}%
					</Badge>
					<span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground capitalize">
						{mediaType === "movie" ? "Movie" : "TV"}
					</span>
				</div>

				{/* Content — anchored to bottom */}
				<div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-1.5 p-3">
					<h3 className="text-[15px] font-bold leading-snug text-foreground line-clamp-2">
						{title}
					</h3>
					<p className="text-[10.5px] leading-relaxed text-muted-foreground line-clamp-3">
						{reasoning}
					</p>
					<span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground/50 transition-colors duration-200 group-hover/card:text-foreground">
						<ArrowUpRight size={11} />
						Search
					</span>
				</div>
			</button>
		</div>
	);
}

// ─── Skeletons ──────────────────────────────────────────────────────

function LoadingSkeletons() {
	return (
		<div className={HORIZONTAL_MEDIA_GRID_CLASS}>
			{Array.from({ length: 12 }).map((_, i) => (
				<MediaCardSkeleton key={i} card_type="horizontal" />
			))}
		</div>
	);
}
