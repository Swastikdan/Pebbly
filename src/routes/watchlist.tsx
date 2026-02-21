import { createFileRoute, Link } from "@tanstack/react-router";
import { Frown, Meh, SlidersHorizontal, Smile, X } from "lucide-react";
import type { ComponentType } from "react";
import { useCallback, useId, useMemo, useState } from "react";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { DefaultLoader } from "@/components/default-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	CheckCircle,
	Clock,
	Download,
	Eye,
	Heart,
	Star,
	TrashBin,
	Upload,
} from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { IMAGE_PREFIX } from "@/constants";
import {
	useToggleWatchlistItem,
	useWatchlist,
	type WatchlistItem,
} from "@/hooks/usewatchlist";
import { useWatchlistImportExport } from "@/hooks/usewatchlistimportexport";
import { formatMediaTitle } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";

export const Route = createFileRoute("/watchlist")({
	head: () => ({
		meta: [
			{ title: "Watchlist | Film Fanatic" },
			{
				name: "description",
				content: "Your saved movies and TV shows.",
			},
		],
	}),
	component: WatchlistPage,
});

const PROGRESS_LABELS: Record<ProgressStatus, string> = {
	"want-to-watch": "Plan to watch",
	watching: "Watching",
	finished: "Completed",
};

const PROGRESS_OPTIONS: Array<{
	value: ProgressStatus;
	label: string;
	icon: ComponentType<{ size?: string | number; className?: string }>;
}> = [
	{ value: "want-to-watch", label: "Plan to watch", icon: Clock },
	{ value: "watching", label: "Watching", icon: Eye },
	{ value: "finished", label: "Completed", icon: CheckCircle },
];

const REACTION_OPTIONS: Array<{
	value: ReactionStatus;
	label: string;
	icon: ComponentType<{ size?: string | number; className?: string }>;
}> = [
	{ value: "loved", label: "Loved", icon: Heart },
	{ value: "liked", label: "Liked", icon: Smile },
	{ value: "mixed", label: "Mixed", icon: Meh },
	{ value: "not-for-me", label: "Not for me", icon: Frown },
];

type FilterType = "all" | ProgressStatus;
type MediaFilter = "all" | "movie" | "tv";
type SortType = "recent" | "rating" | "title" | "year";
type ReactionFilter = "all" | "none" | ReactionStatus;

function WatchlistPage() {
	const importInputId = useId();
	const { watchlist: watchlistData, loading: watchlistLoading } =
		useWatchlist();
	const toggleWatchlist = useToggleWatchlistItem();
	const [activeFilter, setActiveFilter] = useState<FilterType>("all");
	const [reactionFilter, setReactionFilter] = useState<ReactionFilter>("all");
	const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
	const [sortBy, setSortBy] = useState<SortType>("recent");
	// ── NEW: controls the secondary-filter drawer on mobile ──
	const [filtersOpen, setFiltersOpen] = useState(false);
	const {
		importLoading,
		exportLoading,
		error,
		fileInputRef,
		exportWatchlist,
		importWatchlist,
		handleImportClick,
		handleKeyDown,
	} = useWatchlistImportExport();

	// how many secondary filters deviate from defaults
	const activeSecondaryCount = [
		mediaFilter !== "all",
		reactionFilter !== "all",
		sortBy !== "recent",
	].filter(Boolean).length;

	const resetSecondaryFilters = useCallback(() => {
		setMediaFilter("all");
		setReactionFilter("all");
		setSortBy("recent");
	}, []);

	// ── unchanged logic ──────────────────────────────────────
	const filteredWatchlist = useMemo(() => {
		let items = watchlistData;
		if (activeFilter !== "all") {
			items = items.filter(
				(item) => (item.progressStatus ?? "want-to-watch") === activeFilter,
			);
		}
		if (reactionFilter !== "all") {
			items = items.filter((item) =>
				reactionFilter === "none"
					? item.reaction == null
					: item.reaction === reactionFilter,
			);
		}
		if (mediaFilter !== "all") {
			items = items.filter((item) => item.type === mediaFilter);
		}
		return [...items].sort((a, b) => {
			switch (sortBy) {
				case "rating":
					return (b.rating ?? 0) - (a.rating ?? 0);
				case "title":
					return a.title.localeCompare(b.title);
				case "year":
					return (
						new Date(b.release_date || 0).getTime() -
						new Date(a.release_date || 0).getTime()
					);
				default:
					return (
						(b.created_at ?? b.updated_at ?? 0) -
						(a.created_at ?? a.updated_at ?? 0)
					);
			}
		});
	}, [watchlistData, activeFilter, reactionFilter, mediaFilter, sortBy]);

	const counts = useMemo(
		() => ({
			all: watchlistData.length,
			"want-to-watch": watchlistData.filter(
				(i) => (i.progressStatus ?? "want-to-watch") === "want-to-watch",
			).length,
			watching: watchlistData.filter((i) => i.progressStatus === "watching")
				.length,
			finished: watchlistData.filter((i) => i.progressStatus === "finished")
				.length,
		}),
		[watchlistData],
	);

	const handleRemoveFromWatchlist = useCallback(
		(item: WatchlistItem) => {
			toggleWatchlist({
				title: item.title,
				rating: item.rating,
				image: item.image,
				id: item.external_id,
				media_type: item.type,
				release_date: item.release_date ?? "",
				overview: item.overview,
			}).catch(console.error);
		},
		[toggleWatchlist],
	);
	// ────────────────────────────────────────────────────────

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
				{/* ── Header: title + import/export ── */}
				<div className="mb-8 flex items-start justify-between gap-4">
					<div>
						<h1 className="text-4xl font-bold tracking-tight md:text-5xl">
							Watchlist
						</h1>
						<p className="mt-2 text-xs tracking-wider text-muted-foreground uppercase">
							{watchlistData.length} title
							{watchlistData.length !== 1 ? "s" : ""} saved
						</p>
					</div>

					{/* Import / Export — moved here, text hidden on mobile */}
					<div className="flex shrink-0 items-center gap-2 pt-1">
						{(watchlistData?.length ?? 0) > 0 && (
							<Button
								className="gap-1.5 rounded-xl"
								disabled={exportLoading || importLoading}
								variant="secondary"
								size="sm"
								onClick={exportWatchlist}
								aria-label="Export watchlist"
							>
								{exportLoading ? (
									<Spinner color="current" />
								) : (
									<Download size={15} />
								)}
								<span className="hidden sm:inline">Export</span>
							</Button>
						)}
						<Button
							className="gap-1.5 rounded-xl"
							disabled={importLoading || exportLoading}
							variant="secondary"
							size="sm"
							onClick={handleImportClick}
							onKeyDown={handleKeyDown}
							aria-label="Import watchlist"
						>
							<input
								ref={fileInputRef}
								accept=".json,application/json"
								className="hidden"
								disabled={importLoading || exportLoading}
								id={importInputId}
								type="file"
								onChange={importWatchlist}
							/>
							{importLoading ? (
								<Spinner color="current" />
							) : (
								<Upload size={15} />
							)}
							<span className="hidden sm:inline">Import</span>
						</Button>
					</div>
				</div>

				{error && (
					<div
						className={`mb-4 rounded-xl p-3 text-sm ${
							error.invalidItems
								? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
								: "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
						}`}
						role="alert"
					>
						{error.message}
					</div>
				)}

				{/* ── Filter bar ── */}
				<div className="mb-6 space-y-2">
					{/* Row 1: progress tabs + mobile filter toggle */}
					<div className="flex items-center gap-2">
						<div className="scrollbar-hidden flex flex-1 gap-1.5 overflow-x-auto">
							{(["all", "want-to-watch", "watching", "finished"] as const).map(
								(filter) => (
									<Button
										key={filter}
										variant={activeFilter === filter ? "default" : "secondary"}
										onClick={() => setActiveFilter(filter)}
										className="gap-1.5 rounded-xl h-8 font-normal text-xs"
									>
										{filter === "all" ? "All" : PROGRESS_LABELS[filter]}
										<span className="ml-1 text-[11px] opacity-60">
											{counts[filter]}
										</span>
									</Button>
								),
							)}
						</div>

						{/* Mobile-only: toggle secondary filters */}
						<Button
							onClick={() => setFiltersOpen((prev) => !prev)}
							aria-expanded={filtersOpen}
							variant={
								filtersOpen || activeSecondaryCount > 0
									? "default"
									: "secondary"
							}
							className="gap-1.5 rounded-xl h-8 text-xs"
						>
							<SlidersHorizontal size={13} />
							Filters
							{activeSecondaryCount > 0 && (
								<span className="ml-1 text-[11px] opacity-60">
									{activeSecondaryCount}
								</span>
							)}
						</Button>
					</div>

					{/* Row 2: secondary filters — always on sm+, toggled on mobile */}
					<div className="scrollbar-hidden flex flex-1 gap-1.5 overflow-x-auto"></div>
					<div
						className={`${
							filtersOpen ? "flex" : "hidden"
						} flex-1 items-center gap-2 scrollbar-hidden overflow-x-auto`}
					>
						{/* Media Type */}
						<Select
							value={mediaFilter}
							onValueChange={(value) => setMediaFilter(value as MediaFilter)}
						>
							<SelectTrigger className="w-auto min-w-[110px] gap-1.5 rounded-xl border-default bg-secondary/30 px-3 text-xs font-medium data-[size=default]:h-8 data-[size=sm]:h-8">
								<SelectValue placeholder="Type" />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="movie">Movies</SelectItem>
								<SelectItem value="tv">Series</SelectItem>
							</SelectContent>
						</Select>

						{/* Mood */}
						<Select
							value={reactionFilter}
							onValueChange={(value) =>
								setReactionFilter(value as ReactionFilter)
							}
						>
							<SelectTrigger className="w-auto min-w-[110px] gap-1.5 rounded-xl border-default bg-secondary/30 px-3 text-xs font-medium data-[size=default]:h-8 data-[size=sm]:h-8">
								<SelectValue placeholder="Mood" />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem value="all">All moods</SelectItem>
								<SelectItem value="none">
									<span className="flex items-center gap-2">
										<Meh size={14} />
										No mood
									</span>
								</SelectItem>
								{REACTION_OPTIONS.map((option) => {
									const Icon = option.icon;
									return (
										<SelectItem key={option.value} value={option.value}>
											<span className="flex items-center gap-2">
												<Icon size={14} />
												{option.label}
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>

						{/* Sort */}
						<Select
							value={sortBy}
							onValueChange={(value) => setSortBy(value as SortType)}
						>
							<SelectTrigger className="w-auto min-w-[130px] gap-1.5 rounded-xl border-default bg-secondary/30 px-3 text-xs font-medium data-[size=default]:h-8 data-[size=sm]:h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem value="recent">Recently Added</SelectItem>
								<SelectItem value="rating">Highest Rated</SelectItem>
								<SelectItem value="title">A → Z</SelectItem>
								<SelectItem value="year">Newest Release</SelectItem>
							</SelectContent>
						</Select>

						{/* Reset pill — only shows when filters deviate from defaults */}
						{activeSecondaryCount > 0 && (
							<button
								type="button"
								onClick={resetSecondaryFilters}
								className="pressable-small flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
							>
								<X size={12} />
								Reset
							</button>
						)}
					</div>
				</div>

				{/* ── Grid (unchanged) ── */}
				{watchlistLoading ? (
					<DefaultLoader className="min-h-[calc(100vh-112px)] grid h-full place-content-center items-center justify-center" />
				) : error && filteredWatchlist.length === 0 ? (
					<DefaultEmptyState message={error.message} description={false} />
				) : filteredWatchlist?.length === 0 ? (
					<DefaultEmptyState
						message={
							activeFilter === "all" &&
							mediaFilter === "all" &&
							reactionFilter === "all"
								? "No items in your watchlist"
								: "No items match your filters"
						}
						description={false}
					/>
				) : (
					<div className="stagger-grid grid w-full grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
						{filteredWatchlist.map(
							(item) =>
								item && (
									<WatchlistCard
										key={`${item.type}-${item.external_id}`}
										item={item}
										onRemoveFromWatchlist={handleRemoveFromWatchlist}
									/>
								),
						)}
					</div>
				)}
			</div>
		</section>
	);
}

// WatchlistCard is unchanged
function WatchlistCard({
	item,
	onRemoveFromWatchlist,
}: {
	item: WatchlistItem;
	onRemoveFromWatchlist: (item: WatchlistItem) => void;
}) {
	const progressStatus = item.progressStatus ?? "want-to-watch";
	const reaction = item.reaction ?? null;
	const progressOption =
		PROGRESS_OPTIONS.find((option) => option.value === progressStatus) ??
		PROGRESS_OPTIONS[0];
	const reactionOption = reaction
		? (REACTION_OPTIONS.find((option) => option.value === reaction) ?? null)
		: null;
	const ProgressIcon = progressOption.icon;
	const ReactionIcon = reactionOption?.icon;
	const formattedTitle = formatMediaTitle.encode(item.title);
	const imageUrl = `${IMAGE_PREFIX.SD_POSTER}${item.image}`;
	const formattedDate = item.release_date
		? new Date(item.release_date).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "";

	return (
		<div className="group relative overflow-hidden rounded-2xl border border-default bg-secondary/5 transition-all duration-300 hover:border-foreground/15 hover:bg-secondary/15">
			<div className="flex gap-3 p-3">
				<Link
					// @ts-expect-error - correct link
					to={`/${item.type}/${item.external_id}/${formattedTitle}`}
					className="pressable-small relative shrink-0"
				>
					<Image
						alt={item.title}
						className="h-32 w-22 rounded-xl bg-foreground/10 object-cover transition-all duration-300"
						height={192}
						src={imageUrl}
						width={128}
					/>
				</Link>

				<div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
					<div>
						<Link
							// @ts-expect-error - correct link
							to={`/${item.type}/${item.external_id}/${formattedTitle}`}
							className="pressable-small"
						>
							<h3 className="line-clamp-2 text-sm font-bold">{item.title}</h3>
						</Link>

						<div className="mt-1 flex flex-wrap items-center gap-1.5">
							<Badge
								className="rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
								variant="secondary"
							>
								{item.type}
							</Badge>
							{item.rating > 0 && (
								<Badge
									className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
									variant="secondary"
								>
									<Star className="mr-0.5 size-2.5 fill-current text-yellow-400" />
									{item.rating.toFixed(1)}
								</Badge>
							)}
							{formattedDate && (
								<span className="text-[9px] tracking-wider text-muted-foreground">
									{formattedDate}
								</span>
							)}
						</div>
						{item.overview && (
							<p className="mt-2 line-clamp-2 text-xs text-muted-foreground/80">
								{item.overview}
							</p>
						)}
					</div>

					<div className="flex items-center justify-between gap-2 pt-1">
						<div className="flex flex-row gap-1">
							<div className="inline-flex items-center gap-2 h-7 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold">
								<ProgressIcon size={14} />
								<span>{progressOption.label}</span>
							</div>
							<div className="inline-flex items-center h-7 gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold">
								{reactionOption ? (
									<>
										{ReactionIcon && <ReactionIcon size={14} />}
										<span>{reactionOption.label}</span>
									</>
								) : (
									<>
										<Meh size={14} />
										<span>No mood</span>
									</>
								)}
							</div>
						</div>

						<Button
							variant="ghost"
							size="icon-sm"
							className="text-muted-foreground hover:text-destructive"
							aria-label={`Remove ${item.title} from watchlist`}
							onClick={() => onRemoveFromWatchlist(item)}
						>
							<TrashBin size={14} />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
