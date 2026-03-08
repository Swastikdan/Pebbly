import { GoBack } from "@/components/go-back";
import { RatingCount } from "@/components/media/rating-count";
import { WatchlistStatusMenu } from "@/components/media/watchlist-status-menu";
import { ShareButton } from "@/components/share-button";
import {
	useMediaState,
	useSetProgressStatus,
	useSetReaction,
	useToggleWatchlistItem,
	useWatchlistItem,
} from "@/hooks/usewatchlist";
import type { ProgressStatus, ReactionStatus } from "@/types";

export const MediaTitleContainer = (props: {
	title: string;
	rating: number;
	image: string;
	poster_path: string;
	id: number;
	media_type: "movie" | "tv";
	release_date: string | null;
	description: string;
	tagline: string | null;
	releaseyear: string;
	uscertification: string;
	runtime?: string | null;
	vote_average: number | null;
	vote_count: number | null;
	imdb_url?: string | null;
	tv_status?: string | null;
}) => {
	const {
		id,
		title,
		rating,
		poster_path,
		media_type,
		release_date,
		tagline,
		releaseyear,
		uscertification,
		runtime,
		vote_average,
		vote_count,
		imdb_url,
		tv_status,
	} = props;

	const mediaState = useMediaState(String(id), media_type);
	const setProgressStatus = useSetProgressStatus();
	const setReaction = useSetReaction();
	const toggleWatchlist = useToggleWatchlistItem();
	const { isOnWatchList } = useWatchlistItem(String(id), media_type);
	const progressStatus = mediaState?.progressStatus ?? null;
	const reaction = mediaState?.reaction ?? null;

	const metadata = {
		title,
		image: poster_path,
		rating,
		release_date: release_date ?? "",
		overview: props.description,
	};

	const handleAdd = () => {
		toggleWatchlist({
			...metadata,
			id: String(id),
			media_type,
		}).catch(console.error);
	};

	const handleStatusChange = (status: ProgressStatus) => {
		setProgressStatus(
			String(id),
			media_type,
			status,
			metadata,
			progressStatus,
		);
	};

	const handleReactionChange = (r: ReactionStatus | null) => {
		setReaction(String(id), media_type, r, metadata);
	};

	const handleRemove = () => {
		toggleWatchlist({
			...metadata,
			id: String(id),
			media_type,
		}).catch(console.error);
	};

	const renderWatchListSection = (className?: string) => (
		<div className={className}>
			<WatchlistStatusMenu
				isOnWatchlist={isOnWatchList}
				progressStatus={progressStatus}
				reaction={reaction}
				mediaType={media_type}
				tmdbId={id}
				onAdd={handleAdd}
				onStatusChange={handleStatusChange}
				onReactionChange={handleReactionChange}
				onRemove={handleRemove}
			/>
		</div>
	);

	return (
		<div className="pt-5 pb-4 animate-fade-in">
			<div className="space-y-3 pb-4">
				<div className="flex items-center justify-between gap-3">
					<GoBack title="Back" />
					<div className="flex flex-wrap items-center justify-end gap-2">
						{renderWatchListSection("hidden sm:flex")}
						<ShareButton title={title} />
					</div>
				</div>
				{renderWatchListSection("sm:hidden")}
				<h1 className="text-[19px] font-bold tracking-tight sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
					{imdb_url ? (
						<a
							className="transition-opacity hover:opacity-70"
							href={imdb_url}
							rel="noopener noreferrer"
							target="_blank"
						>
							{title}
						</a>
					) : (
						title
					)}
				</h1>
				{tagline && (
					<h2 className="hidden text-muted-foreground/80 italic sm:flex">
						{tagline}
					</h2>
				)}
			</div>
			<div className="flex flex-row items-center justify-between">
				<span className="flex items-center gap-1.5 text-sm font-light text-muted-foreground whitespace-nowrap">
					{releaseyear && releaseyear !== "null" && (
						<>
							<span>{releaseyear}</span>
							<span className="text-border">·</span>
						</>
					)}

					<span className="rounded-md border border-border/80 px-1.5 py-0.5 text-xs font-medium text-foreground">
						{uscertification}
					</span>
					{runtime && (
						<>
							<span className="text-border">·</span>
							<span>{runtime}</span>
						</>
					)}
					{tv_status && (
						<>
							<span className="text-border">·</span>
							<span>{tv_status}</span>
						</>
					)}
				</span>

				<RatingCount
					rating={parseFloat(vote_average?.toFixed(1) ?? "0")}
					ratingcount={vote_count ?? 0}
				/>
			</div>
		</div>
	);
};
