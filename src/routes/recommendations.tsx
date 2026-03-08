import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowUpRight,
	Clock,
	Film,
	Plus,
	RefreshCw,
	Sparkles,
	Trash2,
	Tv,
} from "lucide-react";
import { useState } from "react";
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
import { GENRE_LIST, HORIZONTAL_MEDIA_GRID_CLASS } from "@/constants";
import type {
	GenerateOptions,
	RecommendationHistoryEntry,
} from "@/hooks/useRecommendations";
import {
	useRecommendationAccess,
	useRecommendations,
} from "@/hooks/useRecommendations";
import { getBasicMovieDetails, getBasicTvDetails } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { AIRecommendation, BasicMovie, BasicTv } from "@/types";

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
		queryFn: () => getBasicMovieDetails({ id: tmdbId! }),
		enabled: !!tmdbId && mediaType === "movie",
		staleTime: 1000 * 60 * 60 * 48,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const tvResult = useQuery({
		queryKey: ["basic_tv_details", tmdbId],
		queryFn: () => getBasicTvDetails({ id: tmdbId! }),
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
		return (
			<PageShell>
				<LoadingSkeletons />
			</PageShell>
		);
	}

	if (!isSignedIn || !hasAccess) {
		return <DefaultNotFoundComponent />;
	}

	return (
		<PageShell>
			<RecommendationsContent />
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

function RecommendationsContent() {
	const { history, isGenerating, error, generate, deleteEntry } =
		useRecommendations();

	const [activeId, setActiveId] = useState<string | null>(null);
	const [genMode, setGenMode] = useState<"watchlist" | "genre">("watchlist");
	const [mediaType, setMediaType] = useState<"movie" | "tv" | undefined>();
	const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

	const toggleGenre = (name: string) => {
		setSelectedGenres((prev) =>
			prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
		);
	};

	const handleGenerate = () => {
		const options: GenerateOptions = { generationType: genMode };
		if (mediaType) options.mediaTypePreference = mediaType;
		if (genMode === "genre" && selectedGenres.length > 0)
			options.genrePreference = selectedGenres.join(", ");
		generate(options);
		setActiveId(null); // will show newest when it arrives
	};

	const handleGenerateAgain = (entry: RecommendationHistoryEntry) => {
		const options: GenerateOptions = {
			generationType:
				(entry.generationType as "watchlist" | "genre") || "watchlist",
		};
		if (entry.mediaTypePreference)
			options.mediaTypePreference = entry.mediaTypePreference as "movie" | "tv";
		if (entry.genrePreference) options.genrePreference = entry.genrePreference;
		generate(options);
		setActiveId(null);
	};

	const handleGenerateMore = (entry: RecommendationHistoryEntry) => {
		const options: GenerateOptions = {
			generationType:
				(entry.generationType as "watchlist" | "genre") || "watchlist",
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
			<div className="space-y-4">
				{/* Mode toggle */}
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex gap-0.5 rounded-lg bg-secondary/40 p-0.5 h-9 items-center ring-1 ring-border/40">
						<Button
							className="h-8 px-4 text-xs font-semibold rounded-md"
							variant={genMode === "watchlist" ? "default" : "ghost"}
							onClick={() => setGenMode("watchlist")}
						>
							From Watchlist
						</Button>
						<Button
							className="h-8 px-4 text-xs font-semibold rounded-md"
							variant={genMode === "genre" ? "default" : "ghost"}
							onClick={() => setGenMode("genre")}
						>
							By Genre
						</Button>
					</div>

					{/* Media type toggle */}
					<div className="flex gap-0.5 rounded-lg bg-secondary/40 p-0.5 h-9 items-center ring-1 ring-border/40">
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

					{/* Generate button */}
					<Button
						onClick={handleGenerate}
						disabled={isGenerating}
						variant="secondary"
						className="gap-2"
					>
						{isGenerating ? (
							<RefreshCw className="size-4 animate-spin" />
						) : history.length > 0 ? (
							<RefreshCw className="size-4" />
						) : (
							<Sparkles className="size-4" />
						)}
						{isGenerating ? "Generating..." : "Generate"}
					</Button>
				</div>

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
					{errorMessages[error] ?? error}
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
					<div className={`stagger-grid ${HORIZONTAL_MEDIA_GRID_CLASS}`}>
						{activeEntry.recommendations.map((rec, i) => (
							<RecommendationCard
								key={`${rec.tmdbId ?? rec.title}-${i}`}
								recommendation={rec}
							/>
						))}
					</div>
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
			{history.length > 1 && (
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
				<div className="flex flex-1 items-center gap-3 pr-2 min-w-0">
					{/* Type badge */}
					<Badge
						variant="outline"
						className="text-[10px] font-medium capitalize shrink-0"
					>
						{entry.generationType === "genre" ? "Genre" : "Watchlist"}
					</Badge>

					{/* Description */}
					<span className="text-xs text-muted-foreground truncate min-w-0">
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
							avg {avgScore}%
						</Badge>
					</div>

					{/* Timestamp */}
					<span className="text-[11px] text-muted-foreground/60 shrink-0 ml-auto sm:ml-0">
						{formatTimestamp(entry.createdAt)}
					</span>

					{/* Result count */}
					<span className="text-[11px] text-muted-foreground/50 shrink-0">
						{entry.recommendations.length} results
					</span>
				</div>
			</AccordionTrigger>

			<AccordionContent className="px-4 pb-4">
				{/* Expanded details */}
				<div className="space-y-4">
					{/* Actions */}
					<div className="flex items-center gap-2 pb-1">
						<Button
							size="sm"
							variant="secondary"
							className="gap-1.5 text-xs h-8"
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
							className="gap-1.5 text-xs h-8"
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
							className="gap-1.5 text-xs h-8"
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
							className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto"
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

// ─── Recommendation Card ────────────────────────────────────────────

function RecommendationCard({
	recommendation,
}: {
	recommendation: AIRecommendation;
}) {
	const { title, tmdbId, mediaType, relevanceScore, reasoning } =
		recommendation;
	const navigate = useNavigate();

	const { data: tmdbData, isLoading, exists } = useTmdbData(tmdbId, mediaType);

	if (tmdbId && isLoading) {
		return <MediaCardSkeleton card_type="horizontal" />;
	}

	// Verified: TMDB data exists AND title matches
	const isVerified = tmdbData && exists && titlesMatch(title, tmdbData.title);

	if (isVerified && tmdbData) {
		return (
			<div className="relative">
				{/* Relevance badge */}
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
					id={tmdbData.id}
					title={tmdbData.title}
					rating={tmdbData.rating}
					image={tmdbData.posterPath ?? ""}
					poster_path={tmdbData.posterPath ?? ""}
					media_type={mediaType}
					release_date={tmdbData.releaseDate}
					overview={tmdbData.overview}
				/>
			</div>
		);
	}

	// Fallback card — no poster available
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
