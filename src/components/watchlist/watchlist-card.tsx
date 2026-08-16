import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Star, TrashBin } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";
import { getProgressOption, getReactionOption } from "@/constants/watchlist";
import { toast } from "@/hooks/use-toast-store";
import { useSetProgressStatus } from "@/hooks/use-watchlist";
import type { WatchlistItem } from "@/hooks/watchlist-store";
import { formatMediaTitle } from "@/lib/utils";
import type { ProgressStatus } from "@/types";

const STATUS_CYCLE: ProgressStatus[] = ["watch-later", "watching", "done"];

function handleRemove(
	e: React.MouseEvent,
	item: WatchlistItem,
	onRemoveFromWatchlist: (item: WatchlistItem) => void,
) {
	e.preventDefault();
	e.stopPropagation();
	onRemoveFromWatchlist(item);
}

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
	const reactionOption =
		reaction && reaction !== "recommended" ? getReactionOption(reaction) : null;
	const isRecommended = reaction === "recommended";
	const ProgressIcon = progressOption.icon;
	const formattedTitle = formatMediaTitle.encode(item.title);
	const imageUrl = `${IMAGE_PREFIX.LQ_POSTER}${item.image}`;
	const blurSrc = item.image
		? `${IMAGE_PREFIX.PREVIEW}${item.image}`
		: undefined;
	const year = item.release_date
		? new Date(item.release_date).getFullYear()
		: null;

	const setProgressStatus = useSetProgressStatus();

	const metadata = {
		title: item.title,
		image: item.image,
		rating: item.rating,
		release_date: item.release_date ?? "",
		overview: item.overview,
	};

	const cycleStatus = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const prev = progressStatus;
		const idx = STATUS_CYCLE.indexOf(progressStatus);
		const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
		if (next === prev) return;

		setProgressStatus(
			String(item.external_id),
			item.type,
			next,
			metadata,
			prev,
		);
		toast({
			title: `Marked as ${getProgressOption(next).label}`,
			action: {
				label: "Undo",
				onClick: () =>
					setProgressStatus(
						String(item.external_id),
						item.type,
						prev,
						metadata,
						next,
					),
			},
		});
	};

	return (
		<Link
			// @ts-expect-error - correct link
			to={`/${item.type}/${item.external_id}/${formattedTitle}`}
			className="relative flex gap-3.5 rounded-2xl border border-border/40 bg-card p-3.5 transition-[border-color,transform] duration-150 hover:border-border/70 [@media(hover:hover)]:hover:-translate-y-0.5"
		>
			<div className="relative shrink-0">
				<Image
					alt={item.title}
					className="h-[140px] w-[93px] rounded-xl bg-muted object-cover"
					height={210}
					src={imageUrl}
					blurSrc={blurSrc}
					width={140}
					priority={priority}
				/>
			</div>

			<div className="flex min-w-0 flex-1 flex-col justify-between">
				<div>
					<div className="flex items-start justify-between gap-2">
						<h3 className="line-clamp-2 text-sm font-semibold leading-snug">
							{item.title}
						</h3>

						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="shrink-0 p-1.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
							aria-label={`Remove ${item.title} from watchlist`}
							onClick={(e) => handleRemove(e, item, onRemoveFromWatchlist)}
						>
							<TrashBin size={14} />
						</Button>
					</div>

					<div className="mt-1 flex items-center gap-1.5 text-meta text-muted-foreground">
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

				<div className="flex items-center gap-1.5 pt-2 flex-wrap">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={cycleStatus}
						title={`Status: ${progressOption.label}. Tap to change.`}
						aria-label={`Status: ${progressOption.label}. Tap to change.`}
						className="inline-flex h-auto items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1 text-[10px] font-medium text-secondary-foreground hover:bg-secondary"
					>
						<ProgressIcon size={12} />
						{progressOption.label}
					</Button>
					{isRecommended && (
						<span className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 text-blue-500 border border-blue-500/30 px-2.5 py-1 text-[10px] font-semibold">
							<Sparkles size={11} />
							Recommended
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
			</div>
		</Link>
	);
}

export function WatchlistCardSkeleton() {
	return (
		<div className="relative flex gap-3.5 rounded-2xl border border-border/40 bg-card p-3.5 animate-pulse">
			<div className="h-[140px] w-[93px] rounded-xl bg-muted shrink-0" />
			<div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
				<div>
					<div className="h-4 w-3/4 rounded bg-muted mb-2" />
					<div className="h-3 w-1/3 rounded bg-muted mb-3" />
					<div className="h-3 w-full rounded bg-muted mb-1.5" />
					<div className="h-3 w-4/5 rounded bg-muted" />
				</div>
				<div className="flex gap-2 pt-2">
					<div className="h-6 w-20 rounded-lg bg-muted" />
				</div>
			</div>
		</div>
	);
}
