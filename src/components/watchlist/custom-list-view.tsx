import { ChevronDown, EllipsisVertical, ListPlus, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { DefaultLoader } from "@/components/default-loader";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { CustomListMediaCard } from "@/components/watchlist/custom-list-media-card";
import { useCustomListItems } from "@/hooks/use-custom-lists";
import { cn } from "@/lib/utils";

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
								className="border border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground hover:bg-background/80 hover:text-foreground"
								aria-label={`Options for ${list.name}`}
							>
								<EllipsisVertical size={16} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-36 rounded-xl shadow-xl"
						>
							<DropdownMenuItem
								className="rounded-lg gap-2 text-xs py-2"
								onSelect={onEdit}
							>
								<Pencil size={14} />
								Edit Details
							</DropdownMenuItem>
							<DropdownMenuItem
								variant="destructive"
								className="rounded-lg gap-2 text-xs py-2"
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
						{filteredItems.map((item, index) => (
							<CustomListMediaCard
								key={`${item.tmdbId}-${item.mediaType}`}
								item={item}
								listId={list._id}
								priority={index < 7}
							/>
						))}
					</div>
                )}
			</SilentErrorBoundary>
		</div>
	);
}
