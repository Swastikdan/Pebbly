import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListCollage } from "@/components/watchlist/list-collage";

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
		listType?: string;
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

	return (
		<div className="group relative flex flex-col rounded-xl border border-border/45 dark:border-border/20 bg-card/85 dark:bg-card/40 p-3 transition-all duration-350 hover:-translate-y-1 hover:border-border/80">
			<button
				type="button"
				onClick={onClick}
				className="relative aspect-[16/10] w-full overflow-hidden text-left rounded-xl transition-transform duration-300"
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

				{!isPebblyPicks && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground focus-visible:opacity-100"
								aria-label={`Options for ${list.name}`}
							>
								<EllipsisVertical size={14} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-36 rounded-xl shadow-xl border-border/40 backdrop-blur-lg"
						>
							<DropdownMenuItem
								className="rounded-lg gap-2 text-xs py-2"
								onSelect={onEdit}
							>
								<Pencil size={13} className="text-muted-foreground" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem
								variant="destructive"
								className="rounded-lg gap-2 text-xs py-2 text-destructive focus:bg-destructive/15 focus:text-destructive"
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
