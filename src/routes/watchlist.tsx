/**
 * Watchlist page: displays saved movies and TV shows with filtering,
 * sorting, import/export, custom list chips, and removal capabilities.
 */
import { useUser } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	EllipsisVertical,
	Pencil,
	Plus,
	SlidersHorizontal,
	Trash2,
	X,
} from "lucide-react";
import {
	Component,
	type ErrorInfo,
	type ReactNode,
	useCallback,
	useId,
	useMemo,
	useState,
} from "react";
import { CustomListDialog } from "@/components/custom-list-dialog";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	BookMarkFilledIcon,
	Download,
	SearchFilledIcon,
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
	getProgressOption,
	getReactionOption,
	REACTION_OPTIONS,
} from "@/constants/watchlist";
import {
	useToggleWatchlistItem,
	useWatchlist,
	type WatchlistItem,
} from "@/hooks/usewatchlist";
import { useWatchlistImportExport } from "@/hooks/usewatchlistimportexport";
import { cn, formatMediaTitle } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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

/** Silently swallows errors from children (e.g. Convex table-not-found). */
class SilentErrorBoundary extends Component<
	{ children: ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	componentDidCatch(_error: Error, _info: ErrorInfo) {
		// intentionally silent
	}
	render() {
		if (this.state.hasError) return null;
		return this.props.children;
	}
}

type FilterType = "all" | ProgressStatus;
type MediaFilter = "all" | "movie" | "tv";
type SortType = "recent" | "rating" | "title" | "year";
type ReactionFilter = "all" | "none" | ReactionStatus;

function WatchlistPage() {
	const importInputId = useId();
	const { isSignedIn } = useUser();
	const { watchlist: watchlistData, loading: watchlistLoading } =
		useWatchlist();
	const toggleWatchlist = useToggleWatchlistItem();
	const [activeFilter, setActiveFilter] = useState<FilterType>("all");
	const [reactionFilter, setReactionFilter] = useState<ReactionFilter>("all");
	const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
	const [sortBy, setSortBy] = useState<SortType>("recent");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [listFilterIds, setListFilterIds] = useState<Set<string> | null>(null);

	const {
		importLoading,
		exportLoading,
		error,
		fileInputRef,
		exportWatchlist,
		importWatchlist,
		handleImportClick,
	} = useWatchlistImportExport();

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

	const filteredWatchlist = useMemo(() => {
		let items = watchlistData;

		// Filter by custom list
		if (listFilterIds) {
			items = items.filter((item) =>
				listFilterIds.has(`${item.external_id}:${item.type}`),
			);
		}

		if (activeFilter !== "all") {
			items = items.filter(
				(item) => (item.progressStatus ?? "watch-later") === activeFilter,
			);
		} else {
			items = items.filter((item) => item.progressStatus !== "dropped");
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
	}, [
		watchlistData,
		activeFilter,
		reactionFilter,
		mediaFilter,
		sortBy,
		listFilterIds,
	]);

	const counts = useMemo(() => {
		const result = {
			all: 0,
			"watch-later": 0,
			watching: 0,
			done: 0,
			dropped: 0,
		};
		for (const item of watchlistData) {
			const status = item.progressStatus ?? "watch-later";
			if (status === "watch-later") result["watch-later"]++;
			else if (status === "watching") result.watching++;
			else if (status === "done") result.done++;
			else if (status === "dropped") result.dropped++;
			if (status !== "dropped") result.all++;
		}
		return result;
	}, [watchlistData]);

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

	const primaryTabs: Array<{ value: FilterType; label: string }> = [
		{ value: "all", label: "All" },
		{ value: "watch-later", label: "Watch Later" },
		{ value: "watching", label: "Watching" },
		{ value: "done", label: "Done" },
	];

	const showDroppedTab = counts.dropped > 0;
	const hasActiveListFilter = listFilterIds !== null;

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
				{/* Top nav */}
				<div className="mb-6 flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
					<div className="flex items-center gap-2">
						{(watchlistData?.length ?? 0) > 0 && (
							<Button
								className="gap-1.5  text-xs"
								disabled={exportLoading || importLoading}
								variant="secondary"
								onClick={exportWatchlist}
								aria-label="Export watchlist"
							>
								{exportLoading ? (
									<Spinner color="current" />
								) : (
									<Download size={14} />
								)}
								<span className="hidden sm:inline">Export</span>
							</Button>
						)}
						<Button
							className="gap-1.5  text-xs"
							disabled={importLoading || exportLoading}
							variant="secondary"
							onClick={handleImportClick}
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
								<Upload size={14} />
							)}
							<span className="hidden sm:inline">Import</span>
						</Button>
						<ShareButton title="My Watchlist" hideLabelOnMobile />
					</div>
				</div>

				{/* Header */}
				<div className="mb-6">
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
						Watchlist
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						{watchlistData.length} title
						{watchlistData.length !== 1 ? "s" : ""} saved
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

				{/* Custom lists row (auth-only) */}
				{isSignedIn && <CustomListRow onFilterChange={setListFilterIds} />}

				{/* Status tabs + filters */}
				<div className="mb-6 space-y-3">
					<div className="flex items-center gap-2">
						<div className="scrollbar-hidden flex flex-1 gap-1 overflow-x-auto">
							{primaryTabs.map((tab) => {
								const isActive = activeFilter === tab.value;
								return (
									<button
										key={tab.value}
										type="button"
										onClick={() => setActiveFilter(tab.value)}
										className={cn(
											"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
											isActive
												? "bg-foreground text-background"
												: "text-muted-foreground hover:bg-secondary hover:text-foreground",
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
									</button>
								);
							})}
							{showDroppedTab && (
								<button
									type="button"
									onClick={() => setActiveFilter("dropped")}
									className={cn(
										"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
										activeFilter === "dropped"
											? "bg-foreground text-background"
											: "text-muted-foreground/60 hover:bg-secondary hover:text-foreground",
									)}
								>
									Dropped
									<span className="text-[10px] tabular-nums opacity-50">
										{counts.dropped}
									</span>
								</button>
							)}
						</div>

						<Button
							onClick={() => setFiltersOpen((prev) => !prev)}
							aria-expanded={filtersOpen}
							variant={
								filtersOpen || activeSecondaryCount > 0 ? "default" : "ghost"
							}
							size="sm"
							className="gap-1.5 rounded-lg text-xs md:hidden"
						>
							<SlidersHorizontal size={13} />
							{activeSecondaryCount > 0 && (
								<span className="text-[10px] opacity-70">
									{activeSecondaryCount}
								</span>
							)}
						</Button>
					</div>

					<div
						className={cn(
							"flex-1 items-center gap-2 scrollbar-hidden overflow-x-auto",
							filtersOpen ? "flex" : "hidden md:flex",
						)}
					>
						<Select
							value={mediaFilter}
							onValueChange={(value) => setMediaFilter(value as MediaFilter)}
						>
							<SelectTrigger className="w-auto min-w-[100px] gap-1.5 rounded-lg border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
								<SelectValue placeholder="Type" />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="movie">Movies</SelectItem>
								<SelectItem value="tv">Series</SelectItem>
							</SelectContent>
						</Select>

						<Select
							value={reactionFilter}
							onValueChange={(value) =>
								setReactionFilter(value as ReactionFilter)
							}
						>
							<SelectTrigger className="w-auto min-w-[100px] gap-1.5 rounded-lg border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
								<SelectValue placeholder="Mood" />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem value="all">All moods</SelectItem>
								<SelectItem value="none">No mood</SelectItem>
								{REACTION_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										<span className="flex items-center gap-2">
											<option.icon size={14} /> {option.label}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={sortBy}
							onValueChange={(value) => setSortBy(value as SortType)}
						>
							<SelectTrigger className="w-auto min-w-[120px] gap-1.5 rounded-lg border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="rounded-xl">
								<SelectItem value="recent">Recently Added</SelectItem>
								<SelectItem value="rating">Highest Rated</SelectItem>
								<SelectItem value="title">A → Z</SelectItem>
								<SelectItem value="year">Newest Release</SelectItem>
							</SelectContent>
						</Select>

						{activeSecondaryCount > 0 && (
							<button
								type="button"
								onClick={resetSecondaryFilters}
								className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
							>
								<X size={12} />
								Reset
							</button>
						)}
					</div>
				</div>

				{/* Content */}
				{watchlistLoading ? (
					<DefaultLoader className="min-h-[calc(100vh-112px)] grid h-full place-content-center items-center justify-center" />
				) : error && filteredWatchlist.length === 0 ? (
					<DefaultEmptyState message={error.message} description={false} />
				) : filteredWatchlist?.length === 0 ? (
					activeFilter === "all" &&
					mediaFilter === "all" &&
					reactionFilter === "all" &&
					!hasActiveListFilter ? (
						<div className="flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-5 py-16 text-center animate-fade-in-up">
							<div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
								<BookMarkFilledIcon className="size-7 text-muted-foreground" />
							</div>
							<div>
								<h3 className="mb-2 text-lg font-semibold">
									Your watchlist is empty
								</h3>
								<p className="max-w-sm text-sm text-muted-foreground">
									Start adding movies and TV shows to keep track of what you
									want to watch.
								</p>
							</div>
							<Link to="/search">
								<Button
									variant="secondary"
									size="lg"
									className="gap-2 rounded-xl"
								>
									<SearchFilledIcon className="size-4" />
									Browse titles
								</Button>
							</Link>
						</div>
					) : (
						<DefaultEmptyState
							message="No items match your filters"
							description={false}
						/>
					)
				) : (
					<div className="stagger-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

/**
 * Wrapper that keeps the "New List" button always visible even if
 * the Convex queries inside CustomListChips throw (table not deployed).
 */
function CustomListRow({
	onFilterChange,
}: {
	onFilterChange: (ids: Set<string> | null) => void;
}) {
	const [showCreateList, setShowCreateList] = useState(false);

	return (
		<>
			<div className="mb-5 flex items-center gap-2 overflow-x-auto scrollbar-hidden">
				<SilentErrorBoundary>
					<CustomListChips onFilterChange={onFilterChange} />
				</SilentErrorBoundary>

				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowCreateList(true)}
					className="gap-1.5 rounded-xl text-xs shrink-0"
				>
					<Plus size={14} />
					New List
				</Button>
			</div>

			<CustomListDialog
				open={showCreateList}
				onOpenChange={setShowCreateList}
			/>
		</>
	);
}

/** Custom list chips — makes Convex queries so must be inside error boundary. */
function CustomListChips({
	onFilterChange,
}: {
	onFilterChange: (ids: Set<string> | null) => void;
}) {
	const customLists = useQuery(api.watchlist.getCustomLists) ?? [];
	const deleteCustomList = useMutation(api.watchlist.deleteCustomList);
	const [activeListId, setActiveListId] = useState<string | null>(null);
	const [editingList, setEditingList] = useState<{
		id: string;
		name: string;
		color?: string;
	} | null>(null);

	const activeListItems = useQuery(
		api.watchlist.getListItems,
		activeListId ? { listId: activeListId as Id<"lists"> } : "skip",
	);

	useMemo(() => {
		if (!activeListId || !activeListItems) {
			onFilterChange(null);
			return;
		}
		const ids = new Set(
			activeListItems.map((i) => `${i.tmdbId}:${i.mediaType}`),
		);
		onFilterChange(ids);
	}, [activeListId, activeListItems, onFilterChange]);

	const handleSelectList = useCallback(
		(listId: string) => {
			setActiveListId((prev) => {
				const next = prev === listId ? null : listId;
				if (!next) onFilterChange(null);
				return next;
			});
		},
		[onFilterChange],
	);

	if (customLists.length === 0) return null;

	return (
		<>
			{customLists
				.sort((a, b) => a.sortOrder - b.sortOrder)
				.map((list) => {
					const isActive = activeListId === list._id;
					return (
						<div key={list._id} className="flex items-center shrink-0">
							<button
								type="button"
								onClick={() => handleSelectList(list._id)}
								className={cn(
									"inline-flex h-8 items-center gap-2 rounded-l-xl px-3 text-sm font-medium transition-colors whitespace-nowrap",
									isActive
										? "bg-foreground text-background"
										: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
								)}
							>
								{list.color && (
									<span
										className="size-2.5 rounded-full shrink-0"
										style={{ backgroundColor: list.color }}
									/>
								)}
								{list.name}
								{isActive && (
									<X
										size={14}
										className="opacity-60"
										onClick={(e) => {
											e.stopPropagation();
											setActiveListId(null);
											onFilterChange(null);
										}}
									/>
								)}
							</button>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className={cn(
											"flex h-8 items-center rounded-r-xl border-l px-1.5 transition-colors",
											isActive
												? "border-background/20 bg-foreground text-background hover:bg-foreground/90"
												: "border-border/40 bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
										)}
										aria-label={`Options for ${list.name}`}
									>
										<EllipsisVertical size={14} />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="w-36 rounded-xl">
									<DropdownMenuItem
										className="rounded-lg gap-2 text-xs"
										onSelect={() =>
											setEditingList({
												id: list._id,
												name: list.name,
												color: list.color,
											})
										}
									>
										<Pencil size={14} />
										Edit
									</DropdownMenuItem>
									<DropdownMenuItem
										variant="destructive"
										className="rounded-lg gap-2 text-xs"
										onSelect={() => {
											if (activeListId === list._id) {
												setActiveListId(null);
												onFilterChange(null);
											}
											deleteCustomList({ listId: list._id });
										}}
									>
										<Trash2 size={14} />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					);
				})}

			{editingList && (
				<CustomListDialog
					open={true}
					onOpenChange={(open) => {
						if (!open) setEditingList(null);
					}}
					listId={editingList.id}
					initialName={editingList.name}
					initialColor={editingList.color}
				/>
			)}
		</>
	);
}

function WatchlistCard({
	item,
	onRemoveFromWatchlist,
}: {
	item: WatchlistItem;
	onRemoveFromWatchlist: (item: WatchlistItem) => void;
}) {
	const progressStatus = item.progressStatus ?? "watch-later";
	const reaction = item.reaction ?? null;
	const progressOption = getProgressOption(progressStatus);
	const reactionOption = reaction ? getReactionOption(reaction) : null;
	const ProgressIcon = progressOption.icon;
	const formattedTitle = formatMediaTitle.encode(item.title);
	const imageUrl = `${IMAGE_PREFIX.SD_POSTER}${item.image}`;
	const year = item.release_date
		? new Date(item.release_date).getFullYear()
		: null;

	return (
		<div className="relative flex gap-3.5 rounded-2xl border border-border/40 bg-card p-3.5 transition-colors hover:border-border/70">
			<Link
				// @ts-expect-error - correct link
				to={`/${item.type}/${item.external_id}/${formattedTitle}`}
				className="relative shrink-0"
			>
				<Image
					alt={item.title}
					className="h-[140px] w-[93px] rounded-xl bg-muted object-cover"
					height={210}
					src={imageUrl}
					width={140}
				/>
			</Link>

			<div className="flex min-w-0 flex-1 flex-col justify-between">
				<div>
					<div className="flex items-start justify-between gap-2">
						<Link
							// @ts-expect-error - correct link
							to={`/${item.type}/${item.external_id}/${formattedTitle}`}
						>
							<h3 className="line-clamp-2 text-sm font-semibold leading-snug">
								{item.title}
							</h3>
						</Link>

						<button
							type="button"
							className="shrink-0 rounded-lg p-1.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
							aria-label={`Remove ${item.title} from watchlist`}
							onClick={() => onRemoveFromWatchlist(item)}
						>
							<TrashBin size={14} />
						</button>
					</div>

					<div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
						<span className="uppercase">{item.type}</span>
						{year && (
							<>
								<span className="text-border">·</span>
								<span>{year}</span>
							</>
						)}
						{item.rating > 0 && (
							<>
								<span className="text-border">·</span>
								<span className="flex items-center gap-0.5">
									<Star className="size-2.5 fill-yellow-400 text-yellow-400" />
									{item.rating.toFixed(1)}
								</span>
							</>
						)}
					</div>

					{item.overview && (
						<p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/60">
							{item.overview}
						</p>
					)}
				</div>

				<div className="flex items-center gap-1.5 pt-2">
					<span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1 text-[10px] font-medium text-secondary-foreground">
						<ProgressIcon size={12} />
						{progressOption.label}
					</span>
					{reactionOption && (
						<span
							className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1 text-[10px] font-medium text-secondary-foreground"
							title={reactionOption.label}
						>
							<reactionOption.icon size={12} />
							{reactionOption.label}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
