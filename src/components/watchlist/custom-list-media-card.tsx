import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Star, TrashBin } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";
import { getProgressOption, getReactionOption } from "@/constants/watchlist";
import { useToggleListItem } from "@/hooks/use-custom-lists";
import { toast } from "@/hooks/use-toast-store";
import type { MediaType } from "@/lib/media-types";
import { cn, formatMediaTitle } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";

export function CustomListMediaCard({
	item,
	listId,
	priority,
	readOnly,
	rank,
	onMove,
	canMoveUp,
	canMoveDown,
}: {
	item: {
		tmdbId: number;
		mediaType: MediaType;
		title?: string;
		image?: string;
		backdrop?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
		progressStatus?: ProgressStatus;
		reaction?: ReactionStatus;
	};
	listId: string;
	priority?: boolean;
	readOnly?: boolean;
	rank?: number;
	onMove?: (dir: -1 | 1) => void;
	canMoveUp?: boolean;
	canMoveDown?: boolean;
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

	const progressStatus = item.progressStatus ?? "watch-later";
	const reaction = item.reaction ?? null;
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
		})
			.then((added) => {
				if (added) return;
				toast({
					title: "Removed from collection",
					description: item.title,
					action: {
						label: "Undo",
						onClick: () => {
							toggleListItem({
								listId,
								tmdbId: item.tmdbId,
								mediaType: item.mediaType,
								title: item.title,
								image: item.image,
								backdrop: item.backdrop,
								rating: item.rating,
								release_date: item.release_date,
								overview: item.overview,
							}).catch(console.error);
						},
					},
				});
			})
			.catch(console.error);
	};

	const handleMoveClick = (dir: -1 | 1) => (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onMove?.(dir);
	};

	return (
		<Link
			// @ts-expect-error - correct link
			to={
				formattedTitle
					? `/${item.mediaType}/${item.tmdbId}/${formattedTitle}`
					: `/${item.mediaType}/${item.tmdbId}`
			}
			className="relative flex gap-3.5 rounded-xl border border-border/40 bg-card p-3.5 transition-colors hover:border-border/70 group"
		>
			<div className="relative shrink-0">
				{hasMetadata && imageUrl ? (
					<Image
						alt={item.title ?? ""}
						className="h-[140px] w-[93px] rounded-xl bg-muted object-cover"
						height={210}
						src={imageUrl}
						width={140}
						priority={priority}
					/>
				) : (
					<div className="flex h-[140px] w-[93px] shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-semibold uppercase text-muted-foreground animate-pulse">
						{item.mediaType === "movie" ? "MOV" : "TV"}
					</div>
				)}
				{rank !== undefined && (
					<span className="absolute -left-1.5 -top-1.5 flex size-6 items-center justify-center rounded-lg bg-foreground text-[11px] font-extrabold text-background shadow-md ring-2 ring-card tabular-nums">
						{rank}
					</span>
				)}
			</div>

			<div className="flex min-w-0 flex-1 flex-col justify-between">
				<div>
					<div className="flex items-start justify-between gap-2">
						<h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
							{item.title ??
								`${item.mediaType === "movie" ? "Movie" : "TV Show"} #${item.tmdbId}`}
						</h3>

						<div className="flex shrink-0 items-start gap-0.5">
							{!readOnly && onMove !== undefined && (
								<div className="flex flex-col gap-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
									<button
										type="button"
										onClick={handleMoveClick(-1)}
										disabled={!canMoveUp}
										className={cn(
											"flex size-5 items-center justify-center rounded-md text-muted-foreground/60 transition-colors",
											canMoveUp
												? "cursor-pointer hover:bg-secondary hover:text-foreground"
												: "cursor-not-allowed opacity-30",
										)}
										aria-label="Move up one rank"
									>
										<ArrowUp size={12} />
									</button>
									<button
										type="button"
										onClick={handleMoveClick(1)}
										disabled={!canMoveDown}
										className={cn(
											"flex size-5 items-center justify-center rounded-md text-muted-foreground/60 transition-colors",
											canMoveDown
												? "cursor-pointer hover:bg-secondary hover:text-foreground"
												: "cursor-not-allowed opacity-30",
										)}
										aria-label="Move down one rank"
									>
										<ArrowDown size={12} />
									</button>
								</div>
							)}

							{!readOnly && (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="shrink-0 p-1.5 text-muted-foreground/40 opacity-0 transition-colors group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
									aria-label={`Remove from collection`}
									onClick={handleRemove}
								>
									<TrashBin size={14} />
								</Button>
							)}
						</div>
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
							<span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1.5 sm:py-1 text-[10px] font-medium text-secondary-foreground">
								<ProgressIcon size={12} />
								{progressOption.label}
							</span>
						)}
						{reactionOption && (
							<span
								className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1.5 sm:py-1 text-[10px] font-medium text-secondary-foreground"
								title={reactionOption.label}
							>
								<reactionOption.icon size={12} />
								{reactionOption.label}
							</span>
						)}
					</div>
				)}
			</div>
		</Link>
	);
}
