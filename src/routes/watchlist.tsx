import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useId, useMemo, useState } from "react";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { DefaultLoader } from "@/components/default-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Star, Upload } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { WatchlistButton } from "@/components/watchlist-button";
import { IMAGE_PREFIX } from "@/constants";
import { useContinueWatching } from "@/hooks/useWatchProgress";
import {
	useSetItemStatus,
	useWatchlist,
	type WatchlistItem,
} from "@/hooks/usewatchlist";
import { useWatchlistImportExport } from "@/hooks/usewatchlistimportexport";
import { formatMediaTitle } from "@/lib/utils";
import type { WatchlistStatus } from "@/types";

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

const STATUS_LABELS: Record<WatchlistStatus, string> = {
	"plan-to-watch": "Plan to Watch",
	watching: "Watching",
	completed: "Completed",
	liked: "Liked",
	dropped: "Dropped",
};

const STATUS_COLORS: Record<WatchlistStatus, string> = {
	"plan-to-watch":
		"bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
	watching:
		"bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
	completed:
		"bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
	liked: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25",
	dropped: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25",
};

const STATUS_DOT_COLORS: Record<WatchlistStatus, string> = {
	"plan-to-watch": "bg-blue-500",
	watching: "bg-amber-500",
	completed: "bg-emerald-500",
	liked: "bg-rose-500",
	dropped: "bg-zinc-500",
};

type FilterType = "all" | WatchlistStatus;
type MediaFilter = "all" | "movie" | "tv";
type SortType = "recent" | "rating" | "title" | "year";

function WatchlistPage() {
	const importInputId = useId();
	const { watchlist: watchlistData, loading: watchlistLoading } =
		useWatchlist();
	const setItemStatus = useSetItemStatus();
	const { items: continueWatchingItems } = useContinueWatching();
	const [activeFilter, setActiveFilter] = useState<FilterType>("all");
	const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
	const [sortBy, setSortBy] = useState<SortType>("recent");
	const {
		importLoading,
		exportLoading,
		error,
		watchlist,
		fileInputRef,
		exportWatchlist,
		importWatchlist,
		handleImportClick,
		handleKeyDown,
	} = useWatchlistImportExport();

	const filteredWatchlist = useMemo(() => {
		let items = watchlistData;

		// Status filter
		if (activeFilter !== "all") {
			items = items.filter(
				(item) => (item.status ?? "plan-to-watch") === activeFilter,
			);
		}

		// Media type filter
		if (mediaFilter !== "all") {
			items = items.filter((item) => item.type === mediaFilter);
		}

		// Sort
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
				case "recent":
				default:
					return (b.updated_at ?? 0) - (a.updated_at ?? 0);
			}
		});
	}, [watchlistData, activeFilter, mediaFilter, sortBy]);

	const counts = useMemo(
		() => ({
			all: watchlistData.length,
			"plan-to-watch": watchlistData.filter(
				(i) => (i.status ?? "plan-to-watch") === "plan-to-watch",
			).length,
			watching: watchlistData.filter((i) => i.status === "watching").length,
			completed: watchlistData.filter((i) => i.status === "completed").length,
			liked: watchlistData.filter((i) => i.status === "liked").length,
			dropped: watchlistData.filter((i) => i.status === "dropped").length,
		}),
		[watchlistData],
	);

	const handleStatusChange = useCallback(
		(id: string, newStatus: WatchlistStatus) => {
			setItemStatus(id, newStatus);
		},
		[setItemStatus],
	);

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
				{/* Header */}
				<div className="mb-8">
					<h1 className=" text-4xl font-bold tracking-tight md:text-5xl">
						Watchlist
					</h1>
					<p className="mt-2  text-xs tracking-wider text-muted-foreground uppercase">
						{watchlistData.length} title{watchlistData.length !== 1 ? "s" : ""}{" "}
						saved
					</p>
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

				{/* Continue Watching Section */}
				{continueWatchingItems.length > 0 && (
					<div className="animate-fade-in-up mb-8">
						<h2 className="mb-4  text-xl font-bold">Continue Watching</h2>
						<div className="scrollbar-hidden flex gap-3 overflow-x-auto pb-2">
							{continueWatchingItems.slice(0, 8).map((item) => (
								<Link
									key={item.id}
									// @ts-expect-error - correct link
									to={`/${item.type}/${item.id}`}
									className="pressable-small group relative shrink-0"
								>
									<div className="relative h-20 w-36 overflow-hidden rounded-xl bg-foreground/10">
										<div
											className="absolute bottom-0 left-0 h-[3px] bg-foreground/70"
											style={{ width: `${Math.min(item.percent, 100)}%` }}
										/>
									</div>
									<span className="mt-1 block truncate text-xs font-medium">
										{item.type === "tv" && item.context
											? `S${item.context.season}E${item.context.episode}`
											: ""}
									</span>
									<span className=" text-[9px] text-muted-foreground">
										{Math.round(item.percent)}%
									</span>
								</Link>
							))}
						</div>
					</div>
				)}

				{/* Filters Row */}
				<div className="mb-6 flex flex-col gap-4">
					{/* Status Tabs */}
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="scrollbar-hidden flex gap-2 overflow-x-auto">
							{(
								[
									"all",
									"plan-to-watch",
									"watching",
									"completed",
									"liked",
									"dropped",
								] as const
							).map((filter) => (
								<button
									key={filter}
									type="button"
									onClick={() => setActiveFilter(filter)}
									className={`pressable-small whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
										activeFilter === filter
											? "bg-foreground text-background shadow-md"
											: "bg-secondary/40 text-foreground/70 hover:bg-secondary/70"
									}`}
								>
									{filter === "all" ? "All" : STATUS_LABELS[filter]}{" "}
									<span className="ml-1  text-[10px] opacity-60">
										{counts[filter]}
									</span>
								</button>
							))}
						</div>

						<div className="flex gap-3">
							{(watchlist?.length ?? 0) > 0 && (
								<Button
									className="gap-2 rounded-xl"
									disabled={exportLoading || importLoading}
									variant="secondary"
									onClick={exportWatchlist}
									aria-label="Export watchlist"
								>
									{exportLoading ? (
										<Spinner color="current" />
									) : (
										<Download size={18} />
									)}
									Export
								</Button>
							)}
							<Button
								className="gap-2 rounded-xl"
								disabled={importLoading || exportLoading}
								variant="secondary"
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
									<Upload size={18} />
								)}
								Import
							</Button>
						</div>
					</div>

					{/* Secondary Filters: Media type + Sort */}
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex gap-1 rounded-xl bg-secondary/30 p-1">
							{(["all", "movie", "tv"] as const).map((mf) => (
								<button
									key={mf}
									type="button"
									onClick={() => setMediaFilter(mf)}
									className={`pressable-small rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
										mediaFilter === mf
											? "bg-foreground text-background shadow-sm"
											: "text-foreground/60 hover:text-foreground"
									}`}
								>
									{mf === "all" ? "All" : mf === "movie" ? "Movies" : "Series"}
								</button>
							))}
						</div>

						<Select
							value={sortBy}
							onValueChange={(value) => setSortBy(value as SortType)}
						>
							<SelectTrigger className="h-8 gap-2 rounded-xl border-default bg-secondary/30 px-3 text-xs font-medium">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem value="recent">Recently Added</SelectItem>
								<SelectItem value="rating">Highest Rated</SelectItem>
								<SelectItem value="title">A → Z</SelectItem>
								<SelectItem value="year">Newest Release</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Content */}
				{watchlistLoading ? (
					<DefaultLoader className="min-h-[calc(100vh-112px)] grid h-full place-content-center items-center justify-center" />
				) : error && filteredWatchlist.length === 0 ? (
					<DefaultEmptyState message={error.message} description={false} />
				) : filteredWatchlist?.length === 0 ? (
					<DefaultEmptyState
						message={
							activeFilter === "all" && mediaFilter === "all"
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
										key={item.external_id}
										item={item}
										onStatusChange={handleStatusChange}
									/>
								),
						)}
					</div>
				)}
			</div>
		</section>
	);
}

function WatchlistCard({
	item,
	onStatusChange,
}: {
	item: WatchlistItem;
	onStatusChange: (id: string, status: WatchlistStatus) => void;
}) {
	const status = item.status ?? "plan-to-watch";
	const isCompleted = status === "completed";
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
		<div
			className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
				isCompleted
					? "border-emerald-500/20 bg-emerald-500/5"
					: status === "watching"
						? "border-amber-500/20 bg-amber-500/5"
						: status === "liked"
							? "border-rose-500/20 bg-rose-500/5"
							: status === "dropped"
								? "border-zinc-500/20 bg-zinc-500/5"
								: "border-default bg-secondary/5 hover:border-foreground/15 hover:bg-secondary/15"
			} hover:shadow-md`}
		>
			<div className="flex gap-3 p-3">
				{/* Poster */}
				<Link
					// @ts-expect-error - correct link
					to={`/${item.type}/${item.external_id}/${formattedTitle}`}
					className="pressable-small relative shrink-0"
				>
					<Image
						alt={item.title}
						className={`h-32 w-22 rounded-xl bg-foreground/10 object-cover transition-all duration-300 ${isCompleted ? "opacity-40 saturate-50" : ""}`}
						height={192}
						src={imageUrl}
						width={128}
					/>
					{isCompleted && (
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="rounded-full bg-emerald-500/90 p-1.5">
								<svg
									className="size-4 text-white"
									fill="none"
									viewBox="0 0 24 24"
									strokeWidth={3}
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M4.5 12.75l6 6 9-13.5"
									/>
								</svg>
							</div>
						</div>
					)}
				</Link>

				{/* Info */}
				<div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
					<div>
						<Link
							// @ts-expect-error - correct link
							to={`/${item.type}/${item.external_id}/${formattedTitle}`}
							className="pressable-small"
						>
							<h3
								className={`line-clamp-2 text-sm font-bold ${isCompleted ? " opacity-50" : ""}`}
							>
								{item.title}
							</h3>
						</Link>

						<div className="mt-1 flex flex-wrap items-center gap-1.5">
							<Badge
								className="rounded-md px-1.5 py-0.5  text-[9px] font-medium uppercase tracking-wider"
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
								<span className=" text-[9px] tracking-wider text-muted-foreground">
									{formattedDate}
								</span>
							)}
						</div>
					</div>

					{/* Status Selector + Actions */}
					<div className="flex items-center justify-between gap-2 pt-1">
						<Select
							value={status}
							onValueChange={(value) =>
								onStatusChange(item.external_id, value as WatchlistStatus)
							}
						>
							<SelectTrigger
								className={`h-7 gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold shadow-none ${STATUS_COLORS[status]}`}
							>
								<span
									className={`size-1.5 rounded-full ${STATUS_DOT_COLORS[status]}`}
								/>
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								{(
									Object.entries(STATUS_LABELS) as [WatchlistStatus, string][]
								).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										<span className="flex items-center gap-2">
											<span
												className={`size-2 rounded-full ${STATUS_DOT_COLORS[value]}`}
											/>
											{label}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<WatchlistButton
							id={parseInt(item.external_id, 10)}
							image={item.image ?? ""}
							is_on_watchlist_page={true}
							media_type={item.type}
							rating={item.rating ?? 0}
							release_date={item.release_date ?? ""}
							title={item.title}
							className="rounded-lg"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
