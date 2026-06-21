import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AutoScrollTitle } from "@/components/ui/auto-scroll-title";
import { Badge } from "@/components/ui/badge";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistButton } from "@/components/watchlist-button";
import { IMAGE_PREFIX } from "@/constants";
import { useWatchProgress } from "@/hooks/useWatchProgress";
import { getTvSeasonDetails } from "@/lib/queries";
import { cn, formatMediaTitle } from "@/lib/utils";

interface BaseCardProps {
	id: number;
	className?: string;
}

interface MediaCardSpecificProps extends BaseCardProps {
	card_type: "horizontal" | "vertical";
	title: string;
	rating: number;
	image?: string;
	poster_path: string;
	media_type: "movie" | "tv";
	release_date: string | null;
	known_for_department?: string;
	is_on_watchlist_page?: boolean;
	is_on_homepage?: boolean;
	isContinueWatching?: boolean;
	overview?: string;
	priority?: boolean;
	relevanceScore?: number;
}

interface PersonCardSpecificProps extends BaseCardProps {
	card_type: "person";
	name: string;
	profile_path: string;
	known_for_department: string;
	priority?: boolean;
}

export type CardProps = MediaCardSpecificProps | PersonCardSpecificProps;

export interface MediaCardSkeletonProps {
	card_type?: "horizontal" | "vertical" | "person";
	className?: string;
}

const MediaCard = (props: CardProps) => {
	if (props.card_type === "horizontal") {
		return <HorizontalCard {...props} />;
	}
	if (props.card_type === "vertical") {
		return <VerticalCard {...props} />;
	}
	if (props.card_type === "person") {
		return <PersonCard {...props} />;
	}
};

const HorizontalCard = (props: MediaCardSpecificProps) => {
	const {
		title,
		rating,
		image,
		id,
		poster_path,
		media_type,
		release_date,
		is_on_homepage,
		is_on_watchlist_page,
		isContinueWatching,
		overview,
		priority,
		relevanceScore,
	} = props;

	const formattedTitle = formatMediaTitle.encode(title);
	const imageUrl = `${IMAGE_PREFIX.LQ_POSTER}${image}`;
	const year = release_date ? new Date(release_date).getFullYear() : "";

	return (
		<div className="group relative w-40 md:w-44 lg:w-48 ">
			<Link
				// @ts-expect-error - correct link
				to={`/${media_type}/${id}/${formattedTitle}`}
				// biome-ignore lint/suspicious/noExplicitAny: dynamic route workaround
				search={(isContinueWatching ? { play: true } : undefined) as any}
				className="block h-full w-full outline-none ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pressable"
			>
				<div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border/40 transition-all duration-500 ease-out group-hover:ring-border/60  dark:ring-white/[0.06] dark:group-hover:ring-white/10">
					<Image
						alt={title}
						src={imageUrl}
						className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform sm:group-hover:scale-[1.03]"
						width={300}
						height={450}
						priority={priority}
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 transition-opacity duration-300 group-hover:from-black/80" />

					{rating > 0 && (
						<Badge className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium tracking-normal text-white backdrop-blur-md capitalize flex items-center gap-1 border-0">
							<Star className="size-3 fill-yellow-400 text-yellow-400" />
							<span className="font-semibold text-white">
								{rating.toFixed(1)}
							</span>
						</Badge>
					)}

					<Badge className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium tracking-normal text-white backdrop-blur-md capitalize border-0">
						{media_type === "movie" ? "Movie" : "TV"}
					</Badge>
				</div>

				<div className="mt-2.5 flex flex-col gap-0.5 overflow-hidden">
					<AutoScrollTitle
						text={title}
						className="text-sm font-bold leading-tight tracking-tight text-foreground transition-colors duration-200 group-hover:text-primary"
					/>
					<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 min-h-4">
						{year && <span>{year}</span>}
						{year && relevanceScore && (
							<span className="text-muted-foreground/30">•</span>
						)}
						{relevanceScore && (
							<span
								className={cn(
									"font-semibold",
									relevanceScore >= 80
										? "text-emerald-600 dark:text-emerald-400"
										: relevanceScore >= 60
											? "text-amber-600 dark:text-amber-400"
											: "text-muted-foreground",
								)}
							>
								{relevanceScore}% Match
							</span>
						)}
					</div>
				</div>
			</Link>

			<div className="absolute right-2 top-2 z-10 transition-all duration-300 ease-out">
				<WatchlistButton
					id={id}
					image={poster_path}
					is_on_homepage={is_on_homepage}
					is_on_watchlist_page={is_on_watchlist_page}
					media_type={media_type}
					rating={rating}
					release_date={release_date ?? ""}
					title={title}
					overview={overview}
					className="h-8 w-8 rounded-lg bg-black/50 dark:bg-white/90 text-white dark:text-neutral-900 backdrop-blur-sm transition-all duration-200 hover:bg-black/70 dark:hover:bg-white/80 hover:scale-105"
				/>
			</div>
		</div>
	);
};

const VerticalCard = (props: MediaCardSpecificProps) => {
	const {
		title,
		rating,
		image,
		id,
		poster_path,
		media_type,
		release_date,
		is_on_homepage,
		is_on_watchlist_page,
		isContinueWatching,
		overview,
		priority,
	} = props;

	const formattedTitle = formatMediaTitle.encode(title);
	const year = release_date ? new Date(release_date).getFullYear() : "";

	const isTVContinueWatching = isContinueWatching && media_type === "tv";

	const { progress } = useWatchProgress(
		id,
		isTVContinueWatching ? "tv" : "movie",
	);
	const season = progress?.context?.season;
	const episode = progress?.context?.episode;

	const { data: seasonDetails } = useQuery({
		queryKey: ["tv-season", id, season],
		queryFn: () => getTvSeasonDetails({ tvId: id, seasonNumber: season ?? 1 }),
		enabled: !!isTVContinueWatching && !!season,
	});

	const episodeDetail = seasonDetails?.episodes?.find(
		(ep) => ep.episode_number === episode,
	);

	let imageUrl = `${IMAGE_PREFIX.SD_BACKDROP}${image}`;
	if (isTVContinueWatching) {
		if (episodeDetail?.still_path) {
			imageUrl = `${IMAGE_PREFIX.SD_BACKDROP}${episodeDetail.still_path}`;
		} else if (seasonDetails?.poster_path) {
			imageUrl = `${IMAGE_PREFIX.SD_POSTER}${seasonDetails.poster_path}`;
		}
	}

	return (
		<div className="group relative w-64 md:w-72 lg:w-80 ">
			<Link
				// @ts-expect-error - correct link
				to={`/${media_type}/${id}/${formattedTitle}`}
				// biome-ignore lint/suspicious/noExplicitAny: dynamic route workaround
				search={(isContinueWatching ? { play: true } : undefined) as any}
				className="block h-full w-full outline-none ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pressable"
			>
				<div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border/40 transition-all duration-500 ease-out group-hover:ring-border/60 dark:ring-white/[0.06] dark:group-hover:ring-white/10">
					<Image
						alt={title}
						src={imageUrl}
						className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform sm:group-hover:scale-[1.03]"
						width={450}
						height={300}
						priority={priority}
					/>

					<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 transition-opacity duration-300 group-hover:from-black/80" />

					{rating > 0 && (
						<Badge className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium tracking-normal text-white backdrop-blur-md capitalize flex items-center gap-1 border-0">
							<Star className="size-3 fill-yellow-400 text-yellow-400" />
							<span className="font-semibold text-white">
								{rating.toFixed(1)}
							</span>
						</Badge>
					)}

					<Badge className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium tracking-normal text-white backdrop-blur-md capitalize border-0">
						{media_type === "movie" ? "Movie" : "TV Series"}
					</Badge>
				</div>

				<div className="mt-2.5 flex flex-col gap-1 overflow-hidden">
					{isTVContinueWatching && season && episode && (
						<div className="flex items-center gap-1.5 flex-wrap">
							<span className="text-xs font-bold text-blue-500 dark:text-blue-400">
								S{season} E{episode}
							</span>
							{episodeDetail?.name && (
								<>
									<span className="text-muted-foreground/50 text-[10px]">
										•
									</span>
									<span className="truncate text-xs font-medium text-muted-foreground/80 max-w-[150px]">
										{episodeDetail.name}
									</span>
								</>
							)}
						</div>
					)}
					<AutoScrollTitle
						text={title}
						className="min-h-5 text-sm font-bold leading-tight tracking-tight text-foreground transition-colors duration-200 group-hover:text-primary"
					/>

					{!isTVContinueWatching && (
						<span className="text-xs font-medium text-muted-foreground/70 capitalize">
							{year}
						</span>
					)}
				</div>
			</Link>

			<div className="absolute right-2 top-2 z-10 transition-all duration-300 ease-out">
				<WatchlistButton
					id={id}
					image={poster_path}
					is_on_homepage={is_on_homepage}
					is_on_watchlist_page={is_on_watchlist_page}
					media_type={media_type}
					rating={rating}
					release_date={release_date ?? ""}
					title={title}
					overview={overview}
					className="h-8 w-8 rounded-lg bg-black/50 dark:bg-white/90 text-white dark:text-neutral-900 backdrop-blur-sm transition-all duration-200 hover:bg-black/70 dark:hover:bg-white/80 hover:scale-105"
				/>
			</div>
		</div>
	);
};

const PersonCard = (props: PersonCardSpecificProps) => {
	const { id, name, profile_path, known_for_department, priority } = props;
	const imageUrl = `${IMAGE_PREFIX.SD_PROFILE}${profile_path}`;

	return (
		<Link
			to="/person/$id"
			params={{ id: String(id) }}
			className="group relative block w-24 md:w-28 lg:w-32 outline-none ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pressable "
		>
			<div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border/40 transition-all duration-500 ease-out group-hover:ring-border/60  dark:ring-white/[0.06] dark:group-hover:ring-white/10">
				<Image
					alt={name}
					src={imageUrl}
					className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform sm:group-hover:scale-[1.03]"
					width={200}
					height={300}
					priority={priority}
				/>
			</div>

			<div className="mt-2 flex flex-col items-start text-start overflow-hidden">
				<AutoScrollTitle
					text={name}
					className="w-full truncate text-sm font-bold leading-tight text-foreground group-hover:text-primary transition-colors duration-200"
				/>
				<span className="w-full truncate text-[11px] font-medium text-muted-foreground/70">
					{known_for_department}
				</span>
			</div>
		</Link>
	);
};

const MediaCardSkeleton = (props: MediaCardSkeletonProps) => {
	if (props.card_type === "horizontal") {
		return (
			<div className="w-40 md:w-44 lg:w-48">
				<div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl">
					<Skeleton className="absolute inset-0 rounded-xl" />
					<div className="absolute bottom-2 left-2">
						<Skeleton className="h-[18px] w-12 rounded-md" />
					</div>
					<div className="absolute bottom-2 right-2">
						<Skeleton className="h-[18px] w-10 rounded-md" />
					</div>
				</div>
				<div className="mt-2.5 flex flex-col gap-1">
					<Skeleton className="h-[14px] w-3/4 rounded-md" />
					<Skeleton className="h-3 w-1/4 rounded-md" />
				</div>
			</div>
		);
	}
	if (props.card_type === "vertical") {
		return (
			<div className="w-64 md:w-72 lg:w-80">
				<div className="relative aspect-video w-full overflow-hidden rounded-xl">
					<Skeleton className="absolute inset-0 rounded-xl" />
					<div className="absolute bottom-2 left-2">
						<Skeleton className="h-[18px] w-12 rounded-md" />
					</div>
					<div className="absolute bottom-2 right-2">
						<Skeleton className="h-[18px] w-14 rounded-md" />
					</div>
				</div>
				<div className="mt-2.5 flex flex-col gap-1">
					<Skeleton className="h-[14px] w-3/4 rounded-md" />
					<Skeleton className="h-3 w-1/4 rounded-md" />
				</div>
			</div>
		);
	}

	return (
		<div className="w-24 md:w-28 lg:w-32">
			<Skeleton className="aspect-[2/3] w-full rounded-xl" />
			<div className="mt-2 flex flex-col items-start gap-1">
				<Skeleton className="h-[14px] w-full rounded-md" />
				<Skeleton className="h-3 w-3/4 rounded-md" />
			</div>
		</div>
	);
};

export { MediaCard, MediaCardSkeleton };
