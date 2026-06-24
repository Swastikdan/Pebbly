import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Star, TrashBin } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";
import { getProgressOption, getReactionOption } from "@/constants/watchlist";
import { useToggleListItem } from "@/hooks/use-custom-lists";
import { formatMediaTitle } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";

export function CustomListMediaCard({
	item,
	listId,
	priority,
	readOnly,
}: {
	item: {
		_id: string;
		tmdbId: number;
		mediaType: "movie" | "tv";
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
		}).catch(console.error);
	};

	return (
		<div className="relative flex gap-3.5 rounded-xl border border-border/40 bg-card p-3.5 transition-colors hover:border-border/70 group">
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
						priority={priority}
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
