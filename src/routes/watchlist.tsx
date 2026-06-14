import { createFileRoute, Link } from "@tanstack/react-router";

import {
	useCustomLists,
	useCustomListItems,
	useDeleteCustomList,
	useToggleListItem,
} from "@/hooks/useCustomLists";
import {
	Bookmark,
	ChevronDown,
	EllipsisVertical,
	ListPlus,
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	IMAGE_PREFIX,
	SECTION_TAB_LIST_CLASS,
	SECTION_TAB_TRIGGER_CLASS,
} from "@/constants";
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

export const Route = createFileRoute("/watchlist")({
	head: () => ({
		meta: [
			{ title: "Watchlist | Pebbly" },
			{
				name: "description",
				content: "Your saved movies and TV shows.",
			},
		],
	}),
	component: WatchlistPage,
});

class SilentErrorBoundary extends Component<
	{ children: ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	componentDidCatch(_error: Error, _info: ErrorInfo) {}
	render() {
		if (this.state.hasError) return null;
		return this.props.children;
	}
}

type FilterType = "all" | ProgressStatus;
type MediaFilter = "all" | "movie" | "tv";
type SortType = "recent" | "rating" | "title" | "year";
type ReactionFilter = "all" | "none" | ReactionStatus;
type PageTab = "watchlist" | "my-lists";

function WatchlistPage() {
	const [activeTab, setActiveTab] = useState<PageTab>("watchlist");

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
				<div className="mb-6 flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
					<ShareButton title="My Watchlist" hideLabelOnMobile />
				</div>

				<div className="mb-6">
					<div className="flex items-center gap-4">
						<Tabs
							value={activeTab}
							onValueChange={(v) => setActiveTab(v as PageTab)}
							className="w-full"
						>
							<div className="flex items-center justify-between gap-3">
								<TabsList className={SECTION_TAB_LIST_CLASS}>
									<TabsTrigger
										value="watchlist"
										className={SECTION_TAB_TRIGGER_CLASS}
									>
										<Bookmark size={15} />
										Watchlist
									</TabsTrigger>
									<TabsTrigger
										value="my-lists"
										className={SECTION_TAB_TRIGGER_CLASS}
									>
										<ListPlus size={15} />
										My Collections
									</TabsTrigger>
								</TabsList>
							</div>

							<TabsContent value="watchlist" className="mt-0">
								<WatchlistTabContent />
							</TabsContent>

							<TabsContent value="my-lists" className="mt-0">
								<SilentErrorBoundary>
									<MyListsTabContent />
								</SilentErrorBoundary>
							</TabsContent>
						</Tabs>
					</div>
				</div>
			</div>
		</section>
	);
}

function WatchlistTabContent() {
	const importInputId = useId();
	const { watchlist: watchlistData, loading: watchlistLoading } =
		useWatchlist();
	const toggleWatchlist = useToggleWatchlistItem();
	const [activeFilter, setActiveFilter] = useState<FilterType>("watch-later");
	const [reactionFilter, setReactionFilter] = useState<ReactionFilter>("all");
	const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
	const [sortBy, setSortBy] = useState<SortType>("recent");
	const [filtersOpen, setFiltersOpen] = useState(false);

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
	}, [watchlistData, activeFilter, reactionFilter, mediaFilter, sortBy]);

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
		{ value: "watch-later", label: "Watch Later" },
		{ value: "watching", label: "Watching" },
		{ value: "all", label: "All" },
		{ value: "done", label: "Done" },
	];

	const showDroppedTab = counts.dropped > 0;

	return (
		<div className="pt-5">
			<div className="mb-5 flex items-center justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold tracking-tight sm:text-2xl">
						Watchlist
					</h2>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{watchlistData.length} title
						{watchlistData.length !== 1 ? "s" : ""} saved
					</p>
				</div>
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
						<Input
							ref={fileInputRef}
							accept=".json,application/json"
							className="hidden"
							disabled={importLoading || exportLoading}
							id={importInputId}
							type="file"
							onChange={importWatchlist}
						/>
						{importLoading ? <Spinner color="current" /> : <Upload size={14} />}
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

			<div className="mb-6 space-y-3">
				<div className="flex items-center gap-2">
					<div className="scrollbar-hidden flex flex-1 gap-1 overflow-x-auto">
						{primaryTabs.map((tab) => {
							const isActive = activeFilter === tab.value;
							return (
								<Button
									key={tab.value}
									type="button"
									variant={isActive ? "default" : "ghost"}
									onClick={() => setActiveFilter(tab.value)}
									className={cn(
										"h-auto items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
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
								</Button>
							);
						})}
						{showDroppedTab && (
							<Button
								type="button"
								variant={activeFilter === "dropped" ? "default" : "ghost"}
								onClick={() => setActiveFilter("dropped")}
								className={cn(
									"h-auto items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
									activeFilter === "dropped"
										? "bg-foreground text-background"
										: "text-muted-foreground/60 hover:bg-secondary hover:text-foreground",
								)}
							>
								Dropped
								<span className="text-[10px] tabular-nums opacity-50">
									{counts.dropped}
								</span>
							</Button>
						)}
					</div>

					<Button
						onClick={() => setFiltersOpen((prev) => !prev)}
						aria-expanded={filtersOpen}
						variant={
							filtersOpen || activeSecondaryCount > 0 ? "default" : "ghost"
						}
						size="sm"
						className={cn(
							"h-9 w-[132px] justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 ring-border/40",
							filtersOpen || activeSecondaryCount > 0
								? "bg-foreground text-background hover:bg-foreground/90"
								: "bg-secondary/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
						)}
					>
						<SlidersHorizontal size={13} />
						<span className="relative inline-flex w-[72px] justify-center">
							<span
								className={cn(
									"absolute inset-0 transition-opacity",
									filtersOpen ? "opacity-100" : "opacity-0",
								)}
							>
								Simple
							</span>
							<span
								className={cn(
									"absolute inset-0 transition-opacity",
									filtersOpen ? "opacity-0" : "opacity-100",
								)}
							>
								Full options
							</span>
							<span className="invisible">Full options</span>
						</span>
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
						filtersOpen ? "flex" : "hidden",
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
						<Button
							type="button"
							variant="ghost"
							onClick={resetSecondaryFilters}
							className="h-auto items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
						>
							<X size={12} />
							Reset
						</Button>
					)}
				</div>
			</div>

			{watchlistLoading ? (
				<DefaultLoader className="min-h-[calc(100vh-112px)] grid h-full place-content-center items-center justify-center" />
			) : error && filteredWatchlist.length === 0 ? (
				<DefaultEmptyState message={error.message} description={false} />
			) : filteredWatchlist?.length === 0 ? (
				activeFilter === "all" &&
				mediaFilter === "all" &&
				reactionFilter === "all" ? (
					<div className="flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-5 py-16 text-center animate-fade-in-up">
						<div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
							<BookMarkFilledIcon className="size-7 text-muted-foreground" />
						</div>
						<div>
							<h3 className="mb-2 text-lg font-semibold">
								Your watchlist is empty
							</h3>
							<p className="max-w-sm text-sm text-muted-foreground">
								Start adding movies and TV shows to keep track of what you want
								to watch.
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
	);
}

function MyListsTabContent() {
	const { lists: customLists } = useCustomLists();
	const deleteCustomList = useDeleteCustomList();
	const [showCreateList, setShowCreateList] = useState(false);
	const [editingList, setEditingList] = useState<{
		id: string;
		name: string;
		color?: string;
		visibility?: string;
		listType?: string;
	} | null>(null);
	const [selectedListId, setSelectedListId] = useState<string | null>(null);

	const sortedLists = useMemo(
		() => [...customLists].sort((a, b) => a.sortOrder - b.sortOrder),
		[customLists],
	);

	const selectedList = useMemo(
		() => sortedLists.find((l) => l._id === selectedListId) ?? null,
		[sortedLists, selectedListId],
	);

	if (selectedList) {
		return (
			<>
				<CustomListView
					list={selectedList}
					onBack={() => setSelectedListId(null)}
					onEdit={() =>
						setEditingList({
							id: selectedList._id,
							name: selectedList.name,
							color: selectedList.color,
							visibility: selectedList.visibility,
							listType: selectedList.listType,
						})
					}
					onDelete={() => {
						deleteCustomList(selectedList._id);
						setSelectedListId(null);
					}}
				/>
				{editingList && (
					<CustomListDialog
						open={true}
						onOpenChange={(open) => {
							if (!open) setEditingList(null);
						}}
						listId={editingList.id}
						initialName={editingList.name}
						initialColor={editingList.color}
						initialVisibility={editingList.visibility}
						initialListType={editingList.listType}
					/>
				)}
			</>
		);
	}

	return (
		<div className="pt-5 space-y-6">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold tracking-tight sm:text-2xl">
						My Collections
					</h2>
					<p className="mt-0.5 text-sm text-muted-foreground animate-fade-in">
						{customLists.length} collection
						{customLists.length !== 1 ? "s" : ""} created
					</p>
				</div>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => setShowCreateList(true)}
					className="gap-1.5 rounded-xl text-xs"
				>
					<Plus size={14} />
					New Collection
				</Button>
			</div>

			{sortedLists.length === 0 ? (
				<div className="flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-6 py-16 text-center animate-fade-in-up">
					<div className="relative flex size-20 items-center justify-center">
						<div className="absolute size-14 rotate-[-6deg] rounded-2xl border border-border/30 bg-muted/40 shadow-sm" />
						<div className="absolute size-14 rotate-[6deg] rounded-2xl border border-border/40 bg-muted/70 shadow-md" />
						<div className="absolute flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-background shadow-lg shadow-primary/5">
							<ListPlus className="size-6 text-primary" />
						</div>
					</div>
					<div>
						<h3 className="mb-2 text-lg font-bold tracking-tight">
							Create your first collection
						</h3>
						<p className="max-w-sm text-xs leading-relaxed text-muted-foreground/80">
							Organize movies and TV shows into custom lists — like "Sci-Fi
							Favorites" or "Shows to Binge with Friends".
						</p>
					</div>
					<Button
						variant="secondary"
						size="sm"
						className="gap-2 rounded-xl px-5 text-xs font-semibold hover:bg-secondary/80"
						onClick={() => setShowCreateList(true)}
					>
						<Plus size={14} />
						Create Your First Collection
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{sortedLists.map((list) => (
						<CustomListCard
							key={list._id}
							list={list}
							onClick={() => setSelectedListId(list._id as string)}
							onEdit={() =>
								setEditingList({
									id: list._id,
									name: list.name,
									color: list.color,
									visibility: list.visibility,
									listType: list.listType,
								})
							}
							onDelete={() => deleteCustomList(list._id)}
						/>
					))}
				</div>
			)}

			<CustomListDialog
				open={showCreateList}
				onOpenChange={setShowCreateList}
			/>
			{editingList && (
				<CustomListDialog
					open={true}
					onOpenChange={(open) => {
						if (!open) setEditingList(null);
					}}
					listId={editingList.id}
					initialName={editingList.name}
					initialColor={editingList.color}
					initialVisibility={editingList.visibility}
					initialListType={editingList.listType}
				/>
			)}
		</div>
	);
}

function CustomListView({
	list,
	onBack,
	onEdit,
	onDelete,
}: {
	list: {
		_id: string;
		name: string;
		color?: string;
		visibility?: string;
		listType?: string;
		createdAt: number;
		updatedAt: number;
	};
	onBack: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const items = useCustomListItems(list._id);

	const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");

	const filteredItems = useMemo(() => {
		if (!items) return [];
		if (mediaFilter === "all") return items;
		return items.filter((item) => item.mediaType === mediaFilter);
	}, [items, mediaFilter]);

	return (
		<div className="pt-5 animate-fade-in space-y-6">
			{/* Premium Hero Header Banner */}
			<div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-border/50 dark:border-border/20 px-5 py-4 overflow-hidden bg-gradient-to-r from-secondary/40 to-secondary/10 dark:from-zinc-900/60 dark:to-zinc-950/30 backdrop-blur-sm">
				{list.color && (
					<div
						className="absolute right-[-10%] top-[-20%] size-64 rounded-full blur-[100px] opacity-15 pointer-events-none"
						style={{ backgroundColor: list.color }}
					/>
				)}

				<div className="flex items-center gap-4 min-w-0 z-10">
					<Button
						variant="ghost"
						size="icon"
						onClick={onBack}
						className="rounded-xl shrink-0 border border-border/20 bg-background/50 backdrop-blur-sm hover:bg-background/80"
						aria-label="Back to collections"
					>
						<ChevronDown className="size-5 rotate-90" />
					</Button>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							{list.color && (
								<span
									className="size-3 rounded-full shrink-0 animate-pulse"
									style={{ backgroundColor: list.color }}
								/>
							)}
							<h2 className="truncate text-xl font-extrabold tracking-tight sm:text-3xl leading-none">
								{list.name}
							</h2>
						</div>
						<div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/85">
							<span>{items ? `${items.length} titles` : "Loading..."}</span>
							<span>•</span>
							<span>
								Created{" "}
								{new Date(list.createdAt).toLocaleDateString(undefined, {
									month: "short",
									year: "numeric",
								})}
							</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0 self-end md:self-center z-10">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="rounded-xl border border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground hover:bg-background/80 hover:text-foreground"
								aria-label={`Options for ${list.name}`}
							>
								<EllipsisVertical size={16} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-36 rounded-2xl shadow-xl"
						>
							<DropdownMenuItem
								className="rounded-xl gap-2 text-xs py-2"
								onSelect={onEdit}
							>
								<Pencil size={14} />
								Edit Details
							</DropdownMenuItem>
							<DropdownMenuItem
								variant="destructive"
								className="rounded-xl gap-2 text-xs py-2"
								onSelect={onDelete}
							>
								<Trash2 size={14} />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Filters Pill Row */}
			{items && items.length > 0 && (
				<div className="flex gap-1.5 border-b border-border/20 pb-2 overflow-x-auto scrollbar-hidden">
					{(["all", "movie", "tv"] as const).map((filter) => {
						const isActive = mediaFilter === filter;
						const count = items.filter(
							(item) => filter === "all" || item.mediaType === filter,
						).length;
						const label =
							filter === "all"
								? "All"
								: filter === "movie"
									? "Movies"
									: "TV Shows";

						return (
							<Button
								key={filter}
								type="button"
								variant={isActive ? "default" : "ghost"}
								onClick={() => setMediaFilter(filter)}
								className={cn(
									"h-auto items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
									isActive
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-secondary hover:text-foreground",
								)}
							>
								{label}
								<span className="text-[10px] tabular-nums opacity-60">
									{count}
								</span>
							</Button>
						);
					})}
				</div>
			)}

			<SilentErrorBoundary>
				{!items ? (
					<DefaultLoader className="min-h-[50vh] grid place-content-center items-center justify-center" />
				) : items.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-4 py-20 text-center text-muted-foreground animate-fade-in-up">
						<div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/60">
							<ListPlus className="size-6 text-muted-foreground/80" />
						</div>
						<div>
							<p className="text-sm font-semibold text-foreground">
								This collection is empty
							</p>
							<p className="max-w-xs text-xs text-muted-foreground/60 mt-1">
								Add movies and TV shows from their detail pages to build your
								collection.
							</p>
						</div>
					</div>
				) : filteredItems.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
						<p className="text-xs">
							No {mediaFilter === "movie" ? "movies" : "TV shows"} in this list.
						</p>
					</div>
				) : (
					<div className="stagger-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
						{filteredItems.map((item) => (
							<CustomListMediaCard
								key={`${item.tmdbId}-${item.mediaType}`}
								item={item}
								listId={list._id}
							/>
						))}
					</div>
				)}
			</SilentErrorBoundary>
		</div>
	);
}

function ListCollage({
	previews,
	color,
}: {
	previews: string[];
	color?: string;
}) {
	const fallbackBg = color
		? `linear-gradient(135deg, ${color}10 0%, ${color}25 100%)`
		: "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)";

	if (previews.length === 0) {
		return (
			<div
				className="flex size-full items-center justify-center rounded-2xl border border-border/20 shadow-inner bg-card transition-colors duration-300"
				style={{ background: fallbackBg }}
			>
				<ListPlus
					size={28}
					className="text-muted-foreground/40 transition-transform duration-300"
				/>
			</div>
		);
	}

	const imgClass = "size-full object-cover transition-transform duration-500";

	if (previews.length === 1) {
		return (
			<div className="relative size-full overflow-hidden rounded-2xl border border-border/20 shadow-sm bg-border/20">
				<Image
					src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[0]}`}
					alt="List preview"
					layout="fullWidth"
					className={`${imgClass} group-hover:scale-105`}
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
			</div>
		);
	}

	if (previews.length === 2) {
		return (
			<div className="grid size-full grid-cols-2 gap-0.5 overflow-hidden rounded-2xl border border-border/20 shadow-sm bg-border/20">
				<div className="overflow-hidden size-full">
					<Image
						src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[0]}`}
						alt="List preview 1"
						layout="fullWidth"
						className={`${imgClass} group-hover:scale-105`}
					/>
				</div>
				<div className="overflow-hidden size-full">
					<Image
						src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[1]}`}
						alt="List preview 2"
						layout="fullWidth"
						className={`${imgClass} group-hover:scale-105`}
					/>
				</div>
			</div>
		);
	}

	if (previews.length === 3) {
		return (
			<div className="grid size-full grid-cols-3 gap-0.5 overflow-hidden rounded-2xl border border-border/20 shadow-sm bg-border/20">
				<div className="col-span-2 h-full overflow-hidden">
					<Image
						src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[0]}`}
						alt="List preview 1"
						layout="fullWidth"
						className={`${imgClass} group-hover:scale-105`}
					/>
				</div>
				<div className="grid grid-rows-2 gap-0.5 h-full overflow-hidden">
					<div className="overflow-hidden size-full">
						<Image
							src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[1]}`}
							alt="List preview 2"
							layout="fullWidth"
							className={`${imgClass} group-hover:scale-105`}
						/>
					</div>
					<div className="overflow-hidden size-full">
						<Image
							src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[2]}`}
							alt="List preview 3"
							layout="fullWidth"
							className={`${imgClass} group-hover:scale-105`}
						/>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="grid size-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl border border-border/20 shadow-sm bg-border/20">
			{previews.map((preview, i) => (
				<div key={preview} className="overflow-hidden size-full">
					<Image
						src={`${IMAGE_PREFIX.LQ_BACKDROP}${preview}`}
						alt={`List preview ${i + 1}`}
						layout="fullWidth"
						className={`${imgClass} group-hover:scale-105`}
					/>
				</div>
			))}
		</div>
	);
}

function CustomListCard({
	list,
	onClick,
	onEdit,
	onDelete,
}: {
	list: {
		_id: string;
		name: string;
		color?: string;
		createdAt: number;
		updatedAt: number;
		previews?: string[];
		itemCount?: number;
	};
	onClick: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const previews = list.previews ?? [];
	const itemCount = list.itemCount ?? 0;

	return (
		<div className="group relative flex flex-col rounded-2xl border border-border/45 dark:border-border/20 bg-card/85 dark:bg-card/40 p-3 transition-all duration-350 hover:-translate-y-1 hover:border-border/80">
			<button
				type="button"
				onClick={onClick}
				className="relative aspect-[16/10] w-full overflow-hidden text-left rounded-2xl transition-transform duration-300"
			>
				<ListCollage previews={previews} color={list.color} />

				<div className="absolute right-2 top-2 rounded-xl bg-background/95 px-2 py-1 text-[10px] font-bold tracking-tight shadow-md ring-1 ring-border/20 backdrop-blur-md">
					{itemCount} {itemCount === 1 ? "title" : "titles"}
				</div>
			</button>

			<div className="mt-3 flex items-start justify-between gap-2 px-1">
				<button
					type="button"
					onClick={onClick}
					className="min-w-0 flex-1 text-left"
				>
					<h3 className="truncate text-sm font-bold tracking-tight text-foreground transition-colors duration-250 group-hover:text-primary">
						{list.name}
					</h3>
					<p className="mt-0.5 text-[10px] font-medium text-muted-foreground/80">
						Updated{" "}
						{new Date(list.updatedAt).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})}
					</p>
				</button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-8 rounded-xl text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground focus-visible:opacity-100"
							aria-label={`Options for ${list.name}`}
						>
							<EllipsisVertical size={14} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-36 rounded-2xl shadow-xl border-border/40 backdrop-blur-lg"
					>
						<DropdownMenuItem
							className="rounded-xl gap-2 text-xs py-2"
							onSelect={onEdit}
						>
							<Pencil size={13} className="text-muted-foreground" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							className="rounded-xl gap-2 text-xs py-2 text-destructive focus:bg-destructive/15 focus:text-destructive"
							onSelect={onDelete}
						>
							<Trash2 size={13} />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function CustomListMediaCard({
	item,
	listId,
}: {
	item: {
		_id: string;
		tmdbId: number;
		mediaType: string;
		title?: string;
		image?: string;
		backdrop?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
		progressStatus?: string;
		reaction?: string;
	};
	listId: string;
}) {
	const toggleListItem = useToggleListItem();
	const hasMetadata = !!(item.title && (item.backdrop || item.image));
	const formattedTitle = item.title
		? formatMediaTitle.encode(item.title)
		: undefined;
	const imageUrl = item.image
		? `${IMAGE_PREFIX.LQ_POSTER}${item.image}`
		: item.backdrop
			? `${IMAGE_PREFIX.LQ_BACKDROP}${item.backdrop}`
			: undefined;
	const year = item.release_date
		? new Date(item.release_date).getFullYear()
		: null;

	const progressStatus =
		(item.progressStatus as ProgressStatus) ?? "watch-later";
	const reaction = (item.reaction as ReactionStatus) ?? null;
	const progressOption = getProgressOption(progressStatus);
	const reactionOption = reaction ? getReactionOption(reaction) : null;
	const ProgressIcon = progressOption.icon;

	const handleRemove = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		toggleListItem({
			listId: listId,
			tmdbId: item.tmdbId,
			mediaType: item.mediaType,
		}).catch(console.error);
	};

	return (
		<div className="relative flex gap-3.5 rounded-2xl border border-border/40 bg-card p-3.5 transition-colors hover:border-border/70 group">
			<Link
				// @ts-expect-error - correct link
				to={
					formattedTitle
						? `/${item.mediaType}/${item.tmdbId}/${formattedTitle}`
						: `/${item.mediaType}/${item.tmdbId}`
				}
				className="relative shrink-0"
			>
				{hasMetadata && imageUrl ? (
					<Image
						alt={item.title ?? ""}
						className="h-[140px] w-[93px] rounded-xl bg-muted object-cover"
						height={210}
						src={imageUrl}
						width={140}
					/>
				) : (
					<div className="flex h-[140px] w-[93px] shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-semibold uppercase text-muted-foreground animate-pulse">
						{item.mediaType === "movie" ? "MOV" : "TV"}
					</div>
				)}
			</Link>

			<div className="flex min-w-0 flex-1 flex-col justify-between">
				<div>
					<div className="flex items-start justify-between gap-2">
						<Link
							// @ts-expect-error - correct link
							to={
								formattedTitle
									? `/${item.mediaType}/${item.tmdbId}/${formattedTitle}`
									: `/${item.mediaType}/${item.tmdbId}`
							}
						>
							<h3 className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary transition-colors">
								{item.title ??
									`${item.mediaType === "movie" ? "Movie" : "TV Show"} #${item.tmdbId}`}
							</h3>
						</Link>

						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="shrink-0 rounded-lg p-1.5 text-muted-foreground/40 opacity-0 transition-colors group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
							aria-label={`Remove from collection`}
							onClick={handleRemove}
						>
							<TrashBin size={14} />
						</Button>
					</div>

					<div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/90 dark:text-muted-foreground/75">
						<span className="uppercase font-semibold tracking-wide">
							{item.mediaType}
						</span>
						{year && (
							<>
								<span className="text-border">·</span>
								<span>{year}</span>
							</>
						)}
						{(item.rating ?? 0) > 0 && (
							<>
								<span className="text-border">·</span>
								<span className="flex items-center gap-0.5">
									<Star className="size-2.5 fill-yellow-400 text-yellow-400" />
									{item.rating?.toFixed(1)}
								</span>
							</>
						)}
					</div>

					{item.overview && (
						<p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/80 dark:text-muted-foreground/60">
							{item.overview}
						</p>
					)}
				</div>

				{(item.progressStatus || item.reaction) && (
					<div className="flex items-center gap-1.5 pt-2">
						{item.progressStatus && (
							<span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1 text-[10px] font-medium text-secondary-foreground">
								<ProgressIcon size={12} />
								{progressOption.label}
							</span>
						)}
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
				)}
			</div>
		</div>
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
	const imageUrl = `${IMAGE_PREFIX.LQ_POSTER}${item.image}`;
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

						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="shrink-0 rounded-lg p-1.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
							aria-label={`Remove ${item.title} from watchlist`}
							onClick={() => onRemoveFromWatchlist(item)}
						>
							<TrashBin size={14} />
						</Button>
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
