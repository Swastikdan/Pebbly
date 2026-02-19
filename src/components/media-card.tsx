import { Link } from "@tanstack/react-router";
import { AutoScrollTitle } from "@/components/ui/auto-scroll-title";
import { Badge } from "@/components/ui/badge";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistButton } from "@/components/watchlist-button";
import { IMAGE_PREFIX } from "@/constants";
import { formatMediaTitle } from "@/lib/utils";

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
	overview?: string;
}

interface PersonCardSpecificProps extends BaseCardProps {
	card_type: "person";
	name: string;
	profile_path: string;
	known_for_department: string;
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
		overview,
	} = props;

	const formattedTitle = formatMediaTitle.encode(title);
	const imageUrl = `${IMAGE_PREFIX.SD_POSTER}${image}`;
	const year = release_date ? new Date(release_date).getFullYear() : "";

	return (
		<div className="group relative w-40 md:w-44 lg:w-48">
			<Link
				// @ts-expect-error - correct link
				to={`/${media_type}/${id}/${formattedTitle}`}
				className="block h-full w-full outline-none ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-md transition-all duration-500 group-hover:shadow-xl group-hover:shadow-primary/5">
					<Image
						alt={title}
						src={imageUrl}
						className="h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-105"
						width={300}
						height={450}
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0" />

					{rating > 0 && (
						<Badge className="absolute bottom-2 left-2 rounded-md bg-white/30 px-2 py-0.5 text-xs font-medium tracking-normal text-white backdrop-blur-md capitalize flex items-center gap-1">
							<Star className="size-3 fill-yellow-400 text-yellow-400" />
							<span className="text-xs font-medium text-white">
								{rating.toFixed(1)}
							</span>
						</Badge>
					)}

					<Badge className="absolute bottom-2 right-2 rounded-md bg-white/30 px-2 py-0.5 text-xs font-medium tracking-normal text-white backdrop-blur-md capitalize">
						{media_type === "movie" ? "Movie" : "TV"}
					</Badge>
				</div>

				{/* Content */}
				<div className="mt-3 flex flex-col gap-0.5 overflow-hidden">
					<AutoScrollTitle
						text={title}
						className="text-sm font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary"
					/>
					<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/80">
						<span>{year}</span>
					</div>
				</div>
			</Link>

			{/* Watchlist Button (Positioned over image) */}
			<div className="absolute right-2 top-2 z-10 transition-transform duration-300 hover:scale-105">
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
					className="h-9 w-9 rounded-[8px] bg-black/40 dark:bg-white/90 text-white backdrop-blur-sm transition-all hover:bg-black/60 dark:hover:bg-white/80"
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
		overview,
	} = props;

	const formattedTitle = formatMediaTitle.encode(title);
	const imageUrl = `${IMAGE_PREFIX.SD_BACKDROP}${image}`;
	const year = release_date ? new Date(release_date).getFullYear() : "";

	return (
		// Slightly wider card for backdrop images
		<div className="group relative w-64 md:w-72 lg:w-80">
			<Link
				// @ts-expect-error - correct link
				to={`/${media_type}/${id}/${formattedTitle}`}
				className="block h-full w-full outline-none ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{/* Image Container */}
				<div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted shadow-md transition-all duration-500 group-hover:shadow-xl group-hover:shadow-primary/5">
					<Image
						alt={title}
						src={imageUrl}
						className="h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-105"
						width={450}
						height={300}
					/>

					<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0" />

					{rating > 0 && (
						<Badge className="absolute bottom-2 left-2 rounded-md bg-white/30 px-2 py-0.5 text-xs font-medium tracking-normal text-white backdrop-blur-md capitalize flex items-center gap-1">
							<Star className="size-3 fill-yellow-400 text-yellow-400" />
							<span className="text-xs font-medium text-white">
								{rating.toFixed(1)}
							</span>
						</Badge>
					)}

					<Badge className="absolute bottom-2 right-2 rounded-md bg-white/30 px-2 py-0.5 text-xs font-medium tracking-normal text-white backdrop-blur-md capitalize">
						{media_type === "movie" ? "Movie" : "TV Series"}
					</Badge>
				</div>

				<div className="mt-3 flex flex-col gap-0.5 overflow-hidden">
					<AutoScrollTitle
						text={title}
						className="min-h-5 text-sm font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary"
					/>

					<span className="text-xs font-medium text-muted-foreground/80 capitalize">
						{year}
					</span>
				</div>
			</Link>

			<div className="absolute right-2 top-2 z-10 transition-transform duration-300 group-hover:scale-105">
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
					className="h-9 w-9 rounded-[8px] bg-black/40 dark:bg-white/90 text-white backdrop-blur-sm transition-all hover:bg-black/60 dark:hover:bg-white/80"
				/>
			</div>
		</div>
	);
};

const PersonCard = (props: PersonCardSpecificProps) => {
	const { id, name, profile_path, known_for_department } = props;
	const imageUrl = `${IMAGE_PREFIX.SD_PROFILE}${profile_path}`;

	return (
		<Link
			to="/person/$id"
			params={{ id: String(id) }}
			className="group relative block w-24 md:w-28 lg:w-32 outline-none ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted transition-all duration-500 group-hover:shadow-md">
				<Image
					alt={name}
					src={imageUrl}
					className="h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-105"
					width={200}
					height={300}
				/>
				{/* <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" /> */}
			</div>

			<div className="mt-2.5 flex flex-col items-start text-start overflow-hidden">
				<AutoScrollTitle
					text={name}
					className="w-full truncate text-sm font-bold leading-tight text-foreground group-hover:text-primary transition-colors"
				/>
				<span className="w-full truncate text-[11px] font-medium text-muted-foreground group-hover:text-muted-foreground/80">
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
				<Skeleton className="aspect-[2/3] w-full rounded-xl" />
				<div className="mt-3 flex flex-col gap-1">
					<Skeleton className="h-4 w-3/4 rounded-md" />
					<Skeleton className="h-3 w-1/4 rounded-md" />
				</div>
			</div>
		);
	}
	if (props.card_type === "vertical") {
		return (
			<div className="w-64 md:w-72 lg:w-80">
				<Skeleton className="aspect-video w-full rounded-xl" />
				<div className="mt-3 flex flex-col gap-1">
					<Skeleton className="h-4 w-3/4 rounded-md" />
					<Skeleton className="h-3 w-1/4 rounded-md" />
				</div>
			</div>
		);
	}

	// Person skeleton
	return (
		<div className="w-24 md:w-28 lg:w-32">
			<Skeleton className="aspect-[2/3] w-full rounded-xl" />
			<div className="mt-2.5 flex flex-col items-center gap-1.5">
				<Skeleton className="h-4 w-20 rounded-md" />
				<Skeleton className="h-3 w-16 rounded-md" />
			</div>
		</div>
	);
};

export { MediaCard, MediaCardSkeleton };
