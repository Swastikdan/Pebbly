import { Link } from "@tanstack/react-router";
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
	const formattedReleaseDate = release_date
		? new Date(release_date).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "";
	const imageUrl = `${IMAGE_PREFIX.SD_POSTER}${image}`;

	return (
		<div className="relative w-47 md:w-51">
			<WatchlistButton
				className="absolute top-4 right-4 z-20 rounded-[calc(var(--radius-sm)+3px)] "
				id={id}
				image={poster_path}
				is_on_homepage={is_on_homepage}
				is_on_watchlist_page={is_on_watchlist_page}
				media_type={media_type}
				rating={rating}
				release_date={release_date ?? ""}
				title={title}
				overview={overview}
			/>

			<Link
				className="pressable-small block h-full w-full rounded-[calc(var(--radius-xl)+6px)]"
				// @ts-expect-error - correct link
				to={`/${media_type}/${id}/${formattedTitle}`}
			>
				<div className="relative flex flex-col h-full w-full cursor-pointer gap-2 rounded-[calc(var(--radius-xl)+6px)] border-transparent bg-transparent p-2 shadow-none outline-none transition-all duration-300 hover:bg-secondary focus:bg-secondary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 ">
					<div className="relative">
						<Image
							alt={title}
							className="h-64 w-46 rounded-xl bg-foreground/10 md:h-72 md:w-50"
							height={450}
							src={imageUrl}
							width={300}
						/>

						<div className="absolute right-2 bottom-2 z-20 flex items-center gap-2">
							<Badge
								className="rounded-md px-2 font-normal text-xs uppercase md:text-sm"
								variant="secondary"
							>
								{media_type}
							</Badge>
							<Badge
								variant="secondary"
								className="rounded-md font-normal text-xs md:text-sm"
							>
								{rating > 0.0 ? (
									<span className="flex w-full items-center gap-1">
										<Star className="size-4 fill-current text-yellow-400" />
										{rating.toFixed(1)}
									</span>
								) : (
									"NR"
								)}
							</Badge>
						</div>
					</div>
					<div className="flex w-full flex-col gap-2">
						<h3 className="truncate text-start text-sm font-semibold capitalize">
							{title}
						</h3>
						<span className="text-start text-xs">{formattedReleaseDate}</span>
					</div>
				</div>
			</Link>
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
	const formattedReleaseDate = release_date
		? new Date(release_date).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "";
	const imageUrl = `${IMAGE_PREFIX.SD_BACKDROP}${image}`;

	return (
		<div className="relative ">
			<WatchlistButton
				className="absolute top-4 right-4 z-20 rounded-[calc(var(--radius-sm)+3px)] "
				id={id}
				image={poster_path}
				is_on_homepage={is_on_homepage}
				is_on_watchlist_page={is_on_watchlist_page}
				media_type={media_type}
				rating={rating}
				release_date={release_date ?? ""}
				title={title}
				overview={overview}
			/>

			<Link
				className="pressable-small block  rounded-[calc(var(--radius-xl)+6px)]  h-56 w-74"
				// @ts-expect-error - correct link
				to={`/${media_type}/${id}/${formattedTitle}`}
			>
				<div className="relative h-full w-full cursor-pointer gap-2 rounded-[calc(var(--radius-xl)+6px)] border-transparent bg-transparent p-2 shadow-none outline-none transition-all duration-300 hover:bg-secondary focus:bg-secondary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 flex flex-col">
					<div className="relative">
						<Image
							alt={title}
							className="bg-foreground/10 h-40 w-74 rounded-xl"
							height={300}
							src={imageUrl}
							width={450}
						/>

						<div className="absolute right-2 bottom-2 z-20 flex items-center gap-2">
							<Badge
								className="rounded-md px-2 font-normal text-xs uppercase md:text-sm"
								variant="secondary"
							>
								{media_type}
							</Badge>
							<Badge
								variant="secondary"
								className="rounded-md font-normal text-xs md:text-sm"
							>
								{rating > 0.0 ? (
									<span className="flex w-full items-center gap-1">
										<Star className="size-4 fill-current text-yellow-400" />
										{rating.toFixed(1)}
									</span>
								) : (
									"NR"
								)}
							</Badge>
						</div>
					</div>
					<div className="flex w-full flex-col gap-2">
						<h3 className="truncate text-start font-semibold text-sm capitalize">
							{title}
						</h3>
						<span className="text-start text-xs">{formattedReleaseDate}</span>
					</div>
				</div>
			</Link>
		</div>
	);
};

const PersonCard = (props: PersonCardSpecificProps) => {
	const { id, name, profile_path, known_for_department } = props;

	const imageUrl = `${IMAGE_PREFIX.SD_PROFILE}${profile_path}`;

	return (
		<Link
			className="pressable-small relative h-[13.25rem] w-30 block space-y-2 p-2 md:h-[15.5rem] md:w-36"
			to="/person/$id"
			params={{ id: String(id) }}
		>
			<Image
				alt={name}
				className="h-36 w-full rounded-xl bg-foreground/10 md:h-44"
				height={225}
				src={imageUrl}
				width={150}
			/>

			<div className="flex w-full flex-col gap-1">
				<h3 className="truncate text-sm font-semibold">{name}</h3>

				<span className="truncate text-xs">{known_for_department}</span>
			</div>
		</Link>
	);
};

const MediaCardSkeleton = (props: MediaCardSkeletonProps) => {
	if (props.card_type === "horizontal") {
		return (
			<div className="p-2 w-47 h-81 md:w-51 md:h-89">
				<Skeleton className="w-43 h-64 md:w-47 md:h-72 rounded-xl" />
				<div className="flex h-11 flex-col gap-2 pt-2">
					<Skeleton className="h-4 w-32 rounded-md" />
					<Skeleton className="h-3 w-24 rounded-md" />
				</div>
			</div>
		);
	}
	if (props.card_type === "vertical") {
		return (
			<div className="h-[224px] w-[296px]">
				<div className="relative h-full w-full space-y-2 rounded-xl bg-transparent p-2">
					<Skeleton className="h-[160px] w-[280px] rounded-xl" />
					<div className="flex w-full flex-col gap-2">
						<Skeleton className="h-4 w-32 rounded-md" />
						<Skeleton className="h-3 w-24 rounded-md" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-32 w-28 space-y-2 md:h-40 md:w-32 p-2">
			<Skeleton className="relative h-24 w-full md:h-32" />
			<div className="flex h-[40px] flex-col gap-2 md:h-[52px]">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-3 w-16" />
			</div>
		</div>
	);
};

export { MediaCard, MediaCardSkeleton };
