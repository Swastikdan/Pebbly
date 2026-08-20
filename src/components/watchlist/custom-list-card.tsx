import {
	EllipsisVertical,
	Globe,
	ListOrdered,
	Pencil,
	Share2,
	Sparkles,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListCollage } from "@/components/watchlist/list-collage";
import { toast } from "@/hooks/use-toast-store";
import { cn, formatMediaTitle } from "@/lib/utils";

const PEBBLY_PICKS_TYPE = "pebbly-picks";

export function CustomListCard({
	list,
	onClick,
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
		previews?: string[];
		itemCount?: number;
	};
	onClick: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const previews = list.previews ?? [];
	const itemCount = list.itemCount ?? 0;
	const isPebblyPicks = list.listType === PEBBLY_PICKS_TYPE;
	const isOrdered = list.sortType === "ordered";
	const isPublic = list.visibility === "public";

	const handleShareList = async (e?: Event | React.SyntheticEvent) => {
		e?.stopPropagation();
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

	return (
		<div
			className={cn(
				"group relative flex flex-col rounded-xl border bg-card/85 dark:bg-card/40 p-3 transition-[transform,border-color,box-shadow] duration-250 hover:-translate-y-1",
				isPebblyPicks
					? "border-violet-500/50 dark:border-violet-400/40 shadow-[0_10px_35px_-15px_rgba(139,92,246,0.5)] hover:border-violet-500/80"
					: "border-border/45 dark:border-border/20 hover:border-border/80",
			)}
		>
			<button
				type="button"
				onClick={onClick}
				className="relative aspect-[16/10] w-full overflow-hidden text-left rounded-xl transition-transform duration-300 cursor-pointer"
			>
				<ListCollage previews={previews} color={list.color} />

				{isPebblyPicks && (
					<div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-md ring-1 ring-white/20 backdrop-blur-md">
						<Sparkles size={10} />
						Pebbly Picks
					</div>
				)}

				<div className="absolute right-2 top-2 rounded-xl bg-background/95 px-2 py-1 text-[10px] font-bold tracking-tight shadow-md ring-1 ring-border/20 backdrop-blur-md">
					{itemCount} {itemCount === 1 ? "title" : "titles"}
				</div>
			</button>

			<div className="mt-3 flex items-start justify-between gap-2 px-1">
				<button
					type="button"
					onClick={onClick}
					className="min-w-0 flex-1 text-left cursor-pointer"
				>
					<h3 className="truncate text-sm font-bold tracking-tight text-foreground transition-colors duration-250 group-hover:text-primary">
						{list.name}
					</h3>
					<p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/80">
						{isPebblyPicks ? (
							<span className="inline-flex items-center gap-1 font-semibold text-violet-500 dark:text-violet-400">
								<Sparkles size={10} />
								AI-curated for you
							</span>
						) : (
							<>
								<span>
									Updated{" "}
									{new Date(list.updatedAt).toLocaleDateString(undefined, {
										month: "short",
										day: "numeric",
									})}
								</span>
								{isOrdered && (
									<span className="inline-flex items-center gap-0.5">
										<ListOrdered size={10} />
										Ordered
									</span>
								)}
								{isPublic && (
									<span className="inline-flex items-center gap-0.5">
										<Globe size={10} />
										Public
									</span>
								)}
							</>
						)}
					</p>
				</button>

				{!isPebblyPicks && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground focus-visible:opacity-100 cursor-pointer"
								aria-label={`Options for ${list.name}`}
							>
								<EllipsisVertical size={14} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-38 rounded-xl shadow-xl border-border/40 backdrop-blur-lg"
						>
							<DropdownMenuItem
								className="rounded-lg gap-2 text-xs py-2 cursor-pointer"
								onSelect={handleShareList}
							>
								<Share2 size={13} className="text-muted-foreground" />
								{isPublic ? "Share Link" : "Share (Private)"}
							</DropdownMenuItem>
							<DropdownMenuItem
								className="rounded-lg gap-2 text-xs py-2 cursor-pointer"
								onSelect={onEdit}
							>
								<Pencil size={13} className="text-muted-foreground" />
								Edit Details
							</DropdownMenuItem>
							<DropdownMenuItem
								variant="destructive"
								className="rounded-lg gap-2 text-xs py-2 text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
								onSelect={onDelete}
							>
								<Trash2 size={13} />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</div>
	);
}
