import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, ListPlus, Plus, SlidersHorizontal, X } from "lucide-react";
import { lazy, Suspense, useCallback, useId, useMemo, useState } from "react";

const CustomListDialog = lazy(() =>
	import("@/components/custom-list-dialog").then((m) => ({
		default: m.CustomListDialog,
	})),
);

import { DefaultEmptyState } from "@/components/default-empty-state";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import {
	BookMarkFilledIcon,
	Download,
	SearchFilledIcon,
	Upload,
} from "@/components/ui/icons";
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
import { CustomListCard } from "@/components/watchlist/custom-list-card";
import { CustomListView } from "@/components/watchlist/custom-list-view";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { WatchlistCard } from "@/components/watchlist/watchlist-card";
import { SECTION_TAB_LIST_CLASS, SECTION_TAB_TRIGGER_CLASS } from "@/constants";
import { REACTION_OPTIONS } from "@/constants/watchlist";
import { useCustomLists, useDeleteCustomList } from "@/hooks/use-custom-lists";
import {
	useToggleWatchlistItem,
	useWatchlist,
	type WatchlistItem,
} from "@/hooks/use-watchlist";
import { useWatchlistImportExport } from "@/hooks/use-watchlist-import-export";
import { cn } from "@/lib/utils";
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
						<SelectTrigger className="w-auto min-w-[100px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
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
						<SelectTrigger className="w-auto min-w-[100px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
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
						<SelectTrigger className="w-auto min-w-[120px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
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
							className="h-auto items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
						>
							<X size={12} />
							Reset
						</Button>
					)}
				</div>
			</div>

			{watchlistLoading ? (
				<DefaultLoader />
			) : error && filteredWatchlist.length === 0 ? (
				<DefaultEmptyState message={error.message} description={false} />
			) : filteredWatchlist?.length === 0 ? (
				activeFilter === "all" &&
				mediaFilter === "all" &&
				reactionFilter === "all" ? (
					<div className="flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-5 py-16 text-center animate-fade-in-up">
						<div className="flex size-16 items-center justify-center rounded-xl bg-secondary">
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
							<Button variant="secondary" size="lg" className="gap-2">
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
						(item, index) =>
							item && (
								<WatchlistCard
									key={`${item.type}-${item.external_id}`}
									item={item}
									onRemoveFromWatchlist={handleRemoveFromWatchlist}
									priority={index < 7}
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
					<Suspense fallback={null}>
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
					</Suspense>
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
					className="gap-1.5 text-xs"
				>
					<Plus size={14} />
					New Collection
				</Button>
			</div>

			{sortedLists.length === 0 ? (
				<div className="flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-6 py-16 text-center animate-fade-in-up">
					<div className="relative flex size-20 items-center justify-center">
						<div className="absolute size-14 rotate-[-6deg] rounded-xl border border-border/30 bg-muted/40 shadow-sm" />
						<div className="absolute size-14 rotate-[6deg] rounded-xl border border-border/40 bg-muted/70 shadow-md" />
						<div className="absolute flex size-14 items-center justify-center rounded-xl border border-border/80 bg-background shadow-lg shadow-primary/5">
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
						className="gap-2 px-5 text-xs font-semibold hover:bg-secondary/80"
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

			<Suspense fallback={null}>
				<CustomListDialog
					open={showCreateList}
					onOpenChange={setShowCreateList}
				/>
			</Suspense>
			{editingList && (
				<Suspense fallback={null}>
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
				</Suspense>
			)}
		</div>
	);
}
