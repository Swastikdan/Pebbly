import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Star, TrashBin } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";
import { getProgressOption, getReactionOption } from "@/constants/watchlist";
import type { WatchlistItem } from "@/hooks/watchlist-store";
import { formatMediaTitle } from "@/lib/utils";

export function WatchlistCard({
	item,
	onRemoveFromWatchlist,
	priority,
}: {
	item: WatchlistItem;
	onRemoveFromWatchlist: (item: WatchlistItem) => void;
	priority?: boolean;
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
		<div className="relative flex gap-3.5 rounded-xl border border-border/40 bg-card p-3.5 transition-colors hover:border-border/70">
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
					priority={priority}
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
							className="shrink-0 p-1.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
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
