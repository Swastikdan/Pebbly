import { createFileRoute, Link } from "@tanstack/react-router";
import { Frown, Meh, Smile } from "lucide-react";
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

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
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

				<div className="mb-6 flex flex-col gap-4">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="scrollbar-hidden flex gap-2 overflow-x-auto">
							{(["all", "want-to-watch", "watching", "finished"] as const).map(
								(filter) => (
									<button
										key={filter}
										type="button"
										onClick={() => setActiveFilter(filter)}
										className={`pressable-small whitespace-nowrap rounded-xl items-center px-4 py-1.5 text-sm font-medium transition-all duration-300 ${
											activeFilter === filter
												? "bg-foreground text-background "
												: "bg-secondary/40 text-foreground/70 hover:bg-secondary/70"
										}`}
									>
										{filter === "all" ? "All" : PROGRESS_LABELS[filter]}{" "}
										<span className="ml-1  text-[12px] opacity-60">
											{counts[filter]}
										</span>
									</button>
								),
							)}
						</div>

						<div className="flex gap-3">
							{(watchlistData?.length ?? 0) > 0 && (
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

					<div className="flex flex-wrap items-center gap-3">
						<div className="flex gap-1 rounded-xl bg-secondary/30 p-1">
							{(["all", "movie", "tv"] as const).map((mf) => (
								<button
									key={mf}
									type="button"
									onClick={() => setMediaFilter(mf)}
									className={`pressable-small rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
										mediaFilter === mf
											? "bg-foreground text-background "
											: "text-foreground/60 hover:text-foreground"
									}`}
								>
									{mf === "all" ? "All" : mf === "movie" ? "Movies" : "Series"}
								</button>
							))}
						</div>

						<Select
							value={reactionFilter}
							onValueChange={(value) =>
								setReactionFilter(value as ReactionFilter)
							}
						>
							<SelectTrigger className="h-8 gap-2 rounded-xl border-default bg-secondary/30 px-3 text-xs font-medium">
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
						{item.overview && (
							<p className="mt-2 line-clamp-2 text-xs text-muted-foreground/80">
								{item.overview}
							</p>
						)}
					</div>

					<div className="flex items-center justify-between gap-2 pt-1">
						<div className="flex flex-row gap-1">
							<div className="inline-flex items-center gap-2 h-7 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold">
								<ProgressIcon size={14} />
								<span>{progressOption.label}</span>
							</div>
							<div className="inline-flex items-center h-7 gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold">
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
