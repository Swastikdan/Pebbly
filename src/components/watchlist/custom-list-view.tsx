import {
	ChevronDown,
	ChevronUp,
	EllipsisVertical,
	Globe,
	ListOrdered,
	ListPlus,
	Pencil,
	Share2,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DefaultLoader } from "@/components/default-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomListMediaCard } from "@/components/watchlist/custom-list-media-card";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import {
	useCustomListItems,
	useReorderListItems,
} from "@/hooks/use-custom-lists";
import { toast } from "@/hooks/use-toast-store";
import { cn, formatMediaTitle } from "@/lib/utils";

export function CustomListView({
	list,
	onBack,
	onEdit,
	onDelete,
}: {
	list: {
		_id: string;
		name: string;
		color?: string;
		description?: string;
		visibility?: string;
		listType?: string;
		sortType?: string;
		createdAt: number;
		updatedAt: number;
	};
	onBack: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const items = useCustomListItems(list._id);
	const reorderItems = useReorderListItems();
	const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");
	const [reorderPending, setReorderPending] = useState(false);
	const isPebblyPicks = list.listType === "pebbly-picks";
	const isOrdered = list.sortType === "ordered";

	const filteredItems = useMemo(() => {
		if (!items) return [];
		if (mediaFilter === "all") return items;
		return items.filter((item) => item.mediaType === mediaFilter);
	}, [items, mediaFilter]);

	const canReorder = isOrdered && !isPebblyPicks && !!items && items.length > 1;

	// Move an item up/down within the FULL list order (not the filtered view)
	// and persist the new order, so positions stay consistent across filters.
	const moveItem = (fromIndex: number, direction: -1 | 1) => {
		if (!items) return;
		const toIndex = fromIndex + direction;
		if (toIndex < 0 || toIndex >= items.length) return;
		const reordered = [...items];
		const [moved] = reordered.splice(fromIndex, 1);
		reordered.splice(toIndex, 0, moved);
		setReorderPending(true);
		reorderItems({
			listId: list._id,
			orderedItems: reordered.map((item) => ({
				tmdbId: item.tmdbId,
				mediaType: item.mediaType,
			})),
		})
			.catch(console.error)
			.finally(() => setReorderPending(false));
	};

	const isPublic = list.visibility === "public";

	const handleShareList = async () => {
		if (typeof window === "undefined") return;
		if (!isPublic) {
			toast({
				title: "Collection is private",
				description:
					"Edit details and change visibility to Public to share it.",
			});
			return;
		}
		const slug = formatMediaTitle.encode(list.name);
		const shareUrl = `${window.location.origin}/shared-list/${list._id}/${slug}`;
		if (navigator.share) {
			try {
				await navigator.share({
					title: list.name,
					text: list.description || `Check out ${list.name} on Pebbly`,
					url: shareUrl,
				});
			} catch {
				// User cancelled share
			}
		} else {
			try {
				await navigator.clipboard.writeText(shareUrl);
				toast({
					title: "Link copied to clipboard",
					description: "Anyone with this link can view this collection.",
				});
			} catch {
				toast({
					title: "Failed to copy link",
					description: "Please copy the link from your browser.",
				});
			}
		}
	};

	// Rank within the full list (correct even when a movie/TV filter is active).
	const fullIndex = (item: (typeof items)[number]) =>
		items?.findIndex(
			(i) => i.tmdbId === item.tmdbId && i.mediaType === item.mediaType,
		) ?? -1;

	return (
		<div className="pt-5 animate-fade-in space-y-6">
			<div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border/50 dark:border-border/20 px-5 py-4 overflow-hidden bg-gradient-to-r from-secondary/40 to-secondary/10 dark:from-zinc-900/60 dark:to-zinc-950/30 backdrop-blur-sm">
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
						className="shrink-0 border border-border/20 bg-background/50 backdrop-blur-sm hover:bg-background/80"
						aria-label="Back to collections"
					>
						<ChevronDown className="size-5 rotate-90" />
					</Button>
					<div className="min-w-0">
						<div className="flex items-center gap-2 min-w-0 flex-wrap">
							{list.color && (
								<span
									className="size-3 rounded-full shrink-0"
									style={{ backgroundColor: list.color }}
								/>
							)}
							<h2 className="truncate text-xl font-extrabold tracking-tight sm:text-3xl leading-none">
								{list.name}
							</h2>
							{isPublic && (
								<Badge
									variant="secondary"
									className="gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold shrink-0"
								>
									<Globe size={10} />
									Public
								</Badge>
							)}
						</div>
						<div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/85">
							<span>{items ? `${items.length} titles` : "Loading..."}</span>
							{isOrdered && (
								<>
									<span>•</span>
									<span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
										<ListOrdered size={12} />
										Ordered
									</span>
								</>
							)}
							<span>•</span>
							<span>
								Created{" "}
								{new Date(list.createdAt).toLocaleDateString(undefined, {
									month: "short",
									year: "numeric",
								})}
							</span>
						</div>
						{list.description && (
							<p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground/75">
								{list.description}
							</p>
						)}
					</div>
				</div>

				{!isPebblyPicks && (
					<div className="flex items-center gap-2 shrink-0 self-end md:self-center z-10">
						{isPublic && (
							<Button
								variant="secondary"
								size="sm"
								onClick={handleShareList}
								className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-xs cursor-pointer border border-border/30 bg-background/60 hover:bg-background/90 backdrop-blur-sm"
								title="Share public collection link"
							>
								<Share2 size={13} />
								<span>Share</span>
							</Button>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="border border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground hover:bg-background/80 hover:text-foreground cursor-pointer"
									aria-label={`Options for ${list.name}`}
								>
									<EllipsisVertical size={16} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-40 rounded-xl shadow-xl"
							>
								<DropdownMenuItem
									className="rounded-lg gap-2 text-xs py-2 cursor-pointer"
									onSelect={handleShareList}
								>
									<Share2 size={14} />
									{isPublic ? "Share Link" : "Share (Private)"}
								</DropdownMenuItem>
								<DropdownMenuItem
									className="rounded-lg gap-2 text-xs py-2 cursor-pointer"
									onSelect={onEdit}
								>
									<Pencil size={14} />
									Edit Details
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									className="rounded-lg gap-2 text-xs py-2 cursor-pointer"
									onSelect={onDelete}
								>
									<Trash2 size={14} />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)}
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
					<DefaultLoader className="min-h-[50vh]" />
				) : items.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-4 py-20 text-center text-muted-foreground animate-fade-in-up">
						<div className="flex size-14 items-center justify-center rounded-xl bg-secondary/60">
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
						{filteredItems.map((item, index) => {
							const rank = isOrdered ? fullIndex(item) + 1 : undefined;
							const idx = fullIndex(item);
							return (
								<div
									key={`${item.tmdbId}-${item.mediaType}`}
									className="relative"
								>
									<CustomListMediaCard
										item={item}
										listId={list._id}
										priority={index < 7}
										readOnly={isPebblyPicks}
										rank={rank}
									/>
									{canReorder && (
										<div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-background/95 p-1 shadow-md ring-1 ring-border/20 backdrop-blur-md">
											<button
												type="button"
												disabled={reorderPending || idx <= 0}
												onClick={() => moveItem(idx, -1)}
												className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 cursor-pointer"
												aria-label="Move up"
											>
												<ChevronUp size={14} />
											</button>
											<button
												type="button"
												disabled={
													reorderPending || idx >= (items?.length ?? 0) - 1
												}
												onClick={() => moveItem(idx, 1)}
												className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 cursor-pointer"
												aria-label="Move down"
											>
												<ChevronDown size={14} />
											</button>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</SilentErrorBoundary>
		</div>
	);
}
