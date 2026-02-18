import { GoBack } from "@/components/go-back";
import { RatingCount } from "@/components/media/rating-count";
import { ShareButton } from "@/components/share-button";
import {
	CheckCircle,
	Clock,
	Eye,
	Heart,
	XCircleIcon,
} from "@/components/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { WatchlistButton } from "@/components/watchlist-button";
import {
	useSetItemStatus,
	useWatchlistCount,
	useWatchlistItemStatus,
} from "@/hooks/usewatchlist";
import type { WatchlistStatus } from "@/types";

export const MediaTitleContailer = (props: {
	title: string;
	rateing: number;
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
		rateing,
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

	const status = useWatchlistItemStatus(String(id));
	const setItemStatus = useSetItemStatus();
	// Subscribe to watchlist count to trigger re-renders when item is added/removed
	useWatchlistCount();

	return (
		<div className="pt-5 pb-5">
			<div className="space-y-3 pb-5">
				<div className="flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
					<div className="flex items-center gap-3">
						<WatchlistButton
							id={id}
							image={poster_path}
							is_on_homepage={true}
							media_type={media_type}
							rating={rateing}
							release_date={release_date ?? ""}
							title={title}
							overview={props.description}
						/>

						{/* Mood/Status Selector - Only visible when on watchlist */}
						{status && (
							<div className="flex items-center gap-2">
								<span className="hidden sr-only text-xs font-medium text-muted-foreground sm:inline-block">
									Status:
								</span>
								<Select
									value={status}
									onValueChange={(value) =>
										setItemStatus(String(id), value as WatchlistStatus)
									}
								>
									<SelectTrigger className="h-10 min-w-[140px] gap-2 rounded-lg border px-3 text-xs font-semibold  transition-all">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="rounded-xl">
										<SelectItem value="plan-to-watch">
											<span className="flex items-center gap-2">
												<Clock size={16} />
												Plan to Watch
											</span>
										</SelectItem>
										<SelectItem value="watching">
											<span className="flex items-center gap-2">
												<Eye size={16} />
												Watching
											</span>
										</SelectItem>
										<SelectItem value="completed">
											<span className="flex items-center gap-2">
												<CheckCircle size={16} />
												Completed
											</span>
										</SelectItem>
										<SelectItem value="liked">
											<span className="flex items-center gap-2">
												<Heart size={16} />
												Liked
											</span>
										</SelectItem>
										<SelectItem value="dropped">
											<span className="flex items-center gap-2">
												<XCircleIcon size={16} />
												Dropped
											</span>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}

						<ShareButton title={title} hideLabelOnMobile />
					</div>
				</div>
				<h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
					{imdb_url ? (
						<a
							className="hover:text-foreground hover:opacity-70"
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
				{tagline && <h2 className="hidden sm:flex">{tagline}</h2>}
			</div>
			<div className="flex flex-col items-start justify-start space-y-3 sm:flex-row sm:items-center sm:justify-between">
				<span className="space-x-1 font-light whitespace-nowrap">
					{releaseyear && releaseyear !== "null" && (
						<>
							<span className="py-1">{releaseyear}</span>
							<span className="py-1">•</span>
						</>
					)}

					<span className="ring-ring rounded-md px-2 py-1 ring-1">
						{uscertification}
					</span>
					{runtime && (
						<>
							<span className="py-1">•</span>
							<span className="py-1">{runtime}</span>
						</>
					)}
					{tv_status && (
						<>
							<span className="py-1">•</span>
							<span className="py-1">{tv_status}</span>
						</>
					)}
				</span>
				<div className="hidden sm:flex">
					<RatingCount
						rating={parseInt(vote_average?.toFixed(1) ?? "0", 10)}
						ratingcount={vote_count ?? 0}
					/>
				</div>
			</div>
		</div>
	);
};
