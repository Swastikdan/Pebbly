import { Frown, Meh, Smile, X } from "lucide-react";
import type { ComponentType } from "react";
import { GoBack } from "@/components/go-back";
import { RatingCount } from "@/components/media/rating-count";
import { ShareButton } from "@/components/share-button";
import { CheckCircle, Clock, Eye, Heart } from "@/components/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { WatchlistButton } from "@/components/watchlist-button";
import {
	useMediaState,
	useSetProgressStatus,
	useSetReaction,
	useToggleWatchlistItem,
	useWatchlistItem,
} from "@/hooks/usewatchlist";
import { cn } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus } from "@/types";

const REMOVE_FROM_WATCHLIST_VALUE = "__remove_watchlist";

const PROGRESS_OPTIONS: Array<{
	value: ProgressStatus;
	label: string;
	icon: ComponentType<{ size?: string | number; className?: string }>;
}> = [
	{ value: "want-to-watch", label: "Plan to watch", icon: Clock },
	{ value: "watching", label: "Watching", icon: Eye },
	{ value: "finished", label: "Completed", icon: CheckCircle },
	{ value: "dropped", label: "Dropped", icon: X },
];

const REACTION_OPTIONS: Array<{
	value: Exclude<ReactionStatus, null>;
	label: string;
	icon: ComponentType<{ size?: string | number; className?: string }>;
}> = [
	{ value: "loved", label: "Loved", icon: Heart },
	{ value: "liked", label: "Liked", icon: Smile },
	{ value: "mixed", label: "Mixed", icon: Meh },
	{ value: "not-for-me", label: "Not for me", icon: Frown },
];

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

	const mediaState = useMediaState(String(id), media_type);
	const setProgressStatus = useSetProgressStatus();
	const setReaction = useSetReaction();
	const toggleWatchlist = useToggleWatchlistItem();
	const { isOnWatchList } = useWatchlistItem(String(id), media_type);
	const progressStatus = mediaState?.progressStatus ?? null;
	const reaction = mediaState?.reaction ?? null;

	const renderWatchListSection = (className?: string) => (
		<div
			className={cn("flex flex-wrap items-center justify-end gap-2", className)}
		>
			{!isOnWatchList && (
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
			)}

			<div className="flex flex-wrap items-center justify-end gap-2">
				{isOnWatchList && (
					<Select
						value={progressStatus ?? "want-to-watch"}
						onValueChange={(value) => {
							if (value === REMOVE_FROM_WATCHLIST_VALUE) {
								toggleWatchlist({
									title,
									rating: rateing,
									image: poster_path,
									id: String(id),
									media_type,
									release_date: release_date ?? "",
									overview: props.description,
								}).catch(console.error);
								return;
							}

							setProgressStatus(
								String(id),
								media_type,
								value as ProgressStatus,
								{
									title,
									image: poster_path,
									rating: rateing,
									release_date: release_date ?? "",
									overview: props.description,
								},
							);
						}}
					>
						<SelectTrigger className="h-10 min-w-[145px] gap-2 rounded-lg border px-3 text-xs font-semibold transition-all">
							<SelectValue placeholder="Choose status" />
						</SelectTrigger>
						<SelectContent className="rounded-xl">
							{PROGRESS_OPTIONS.map((option) => {
								const Icon = option.icon;
								return (
									<SelectItem
										key={option.value}
										value={option.value}
										className="rounded-lg"
									>
										<span className="flex items-center gap-2">
											<Icon size={16} />
											{option.label}
										</span>
									</SelectItem>
								);
							})}
							<SelectItem
								value={REMOVE_FROM_WATCHLIST_VALUE}
								className="rounded-lg text-destructive focus:text-destructive"
							>
								Remove from Watchlist
							</SelectItem>
						</SelectContent>
					</Select>
				)}
				<Select
					value={reaction ?? "none"}
					onValueChange={(value) => {
						if (value === REMOVE_FROM_WATCHLIST_VALUE) {
							toggleWatchlist({
								title,
								rating: rateing,
								image: poster_path,
								id: String(id),
								media_type,
								release_date: release_date ?? "",
								overview: props.description,
							}).catch(console.error);
							return;
						}

						setReaction(
							String(id),
							media_type,
							value === "none" ? null : (value as ReactionStatus),
							{
								title,
								image: poster_path,
								rating: rateing,
								release_date: release_date ?? "",
								overview: props.description,
							},
						);
					}}
				>
					<SelectTrigger className="h-10 min-w-[145px] gap-2 rounded-lg border px-3 text-xs font-semibold transition-all">
						<SelectValue placeholder="Mood" />
					</SelectTrigger>
					<SelectContent className="rounded-xl">
						<SelectItem value="none" className="rounded-lg">
							<span className="flex items-center gap-2">
								<Meh size={16} />
								No mood
							</span>
						</SelectItem>
						{REACTION_OPTIONS.map((option) => {
							const Icon = option.icon;
							return (
								<SelectItem
									key={option.value}
									value={option.value}
									className="rounded-lg"
								>
									<span className="flex items-center gap-2">
										<Icon size={16} />
										{option.label}
									</span>
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
			</div>
		</div>
	);

	return (
		<div className="pt-5 pb-5">
			<div className="space-y-3 pb-5">
				<div className="flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
					<div className="flex flex-wrap items-center justify-end gap-2">
						{renderWatchListSection("hidden sm:flex")}
						<ShareButton title={title} hideLabelOnMobile />
					</div>
				</div>
				{renderWatchListSection("sm:hidden")}
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
			<div className="flex  space-y-3 flex-row items-center justify-between">
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
				<div className="flex">
					<RatingCount
						rating={parseInt(vote_average?.toFixed(1) ?? "0", 10)}
						ratingcount={vote_count ?? 0}
					/>
				</div>
			</div>
		</div>
	);
};
