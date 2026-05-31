import { useQueries, useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
import { useContinueWatching } from "@/hooks/useWatchProgress";
import {
	getBasicMovieDetails,
	getBasicTvDetails,
	getMedia,
} from "@/lib/queries";
import type { MediaListResultsEntity } from "@/types";

interface MediaListProps extends MediaListResultsEntity {
	is_on_watchlist_page?: boolean;
	is_on_homepage?: boolean;
	isContinueWatching?: boolean;
}
const MediaList = (props: {
	data: MediaListProps[];
	cardType?: "horizontal" | "vertical";
	defaultMediatype?: "movie" | "tv";
	priorityCount?: number;
}) => {
	return (
		<ScrollContainer isButtonsVisible={true}>
			<div className="flex gap-2 p-4 first:pl-0 last:pr-0">
				{props.data.map((item, index) => (
					<MediaCard
						key={item.id}
						id={item.id}
						title={item.title ?? item.name ?? "Untitled"}
						rating={item.vote_average}
						image={
							props.cardType === "vertical"
								? (item.backdrop_path ?? "")
								: (item.poster_path ?? "")
						}
						poster_path={item.poster_path}
						media_type={
							props.defaultMediatype ??
							(item.media_type as unknown as "movie" | "tv")
						}
						release_date={item.first_air_date ?? item.release_date ?? null}
						is_on_watchlist_page={item.is_on_watchlist_page}
						is_on_homepage={item.is_on_homepage}
						isContinueWatching={item.isContinueWatching}
						card_type={props.cardType as unknown as "horizontal" | "vertical"}
						overview={item.overview}
						priority={props.priorityCount ? index < props.priorityCount : false}
					/>
				))}
			</div>
		</ScrollContainer>
	);
};

const MediaSkeletonList = memo(
	(props: { count?: number; cardType?: "horizontal" | "vertical" }) => {
		const cardCount = props.count ?? 6;
		return (
			<ScrollContainer isButtonsVisible={false}>
				<div className="flex gap-2 p-4 first:pl-0 last:pr-0">
					{Array.from({ length: cardCount }).map((_, index) => (
						<MediaCardSkeleton
							key={index}
							card_type={props.cardType ?? "horizontal"}
						/>
					))}
				</div>
			</ScrollContainer>
		);
	},
);

const useMediaQuery = (
	type:
		| "trending_day"
		| "trending_week"
		| "movies_upcoming"
		| "movies_popular"
		| "tv-shows_popular"
		| "movies_top-rated"
		| "tv-shows_top-rated",
	options?: {
		cardType?: "horizontal" | "vertical";
		mediaType?: "movie" | "tv";
	},
) => {
	const { data, isFetching, error } = useQuery({
		queryKey: [type],
		queryFn: () => getMedia({ type }),
	});

	return {
		data,
		isFetching,
		error,
		cardType: options?.cardType ?? "horizontal",
		mediaType: options?.mediaType,
	};
};

function TrendingDayMovies() {
	const { data, isFetching, error, cardType } = useMediaQuery("trending_day");

	if (isFetching || error) return <MediaSkeletonList cardType={cardType} />;
	return <MediaList data={data ?? []} cardType={cardType} priorityCount={4} />;
}

function TrendingWeekMovies() {
	const { data, isFetching, error, cardType } = useMediaQuery("trending_week");

	if (isFetching || error) return <MediaSkeletonList cardType={cardType} />;
	return <MediaList data={data ?? []} cardType={cardType} />;
}

function UpcomingMovies() {
	const { data, isFetching, error, cardType } = useMediaQuery(
		"movies_upcoming",
		{ cardType: "vertical", mediaType: "movie" },
	);

	if (isFetching || error) return <MediaSkeletonList cardType={cardType} />;
	return (
		<MediaList data={data ?? []} cardType={cardType} defaultMediatype="movie" />
	);
}

function PopularMovies() {
	const { data, isFetching, error, cardType } = useMediaQuery(
		"movies_popular",
		{ mediaType: "movie" },
	);

	if (isFetching || error) return <MediaSkeletonList cardType={cardType} />;
	return (
		<MediaList data={data ?? []} cardType={cardType} defaultMediatype="movie" />
	);
}

function PopularTv() {
	const { data, isFetching, error, cardType } = useMediaQuery(
		"tv-shows_popular",
		{ mediaType: "tv" },
	);

	if (isFetching || error) return <MediaSkeletonList cardType={cardType} />;
	return (
		<MediaList data={data ?? []} cardType={cardType} defaultMediatype="tv" />
	);
}

function TopRatedMovies() {
	const { data, isFetching, error, cardType } = useMediaQuery(
		"movies_top-rated",
		{ mediaType: "movie" },
	);

	if (isFetching || error) return <MediaSkeletonList cardType={cardType} />;
	return (
		<MediaList data={data ?? []} cardType={cardType} defaultMediatype="movie" />
	);
}

function TopRatedTv() {
	const { data, isFetching, error, cardType } = useMediaQuery(
		"tv-shows_top-rated",
		{ mediaType: "tv" },
	);

	if (isFetching || error) return <MediaSkeletonList cardType={cardType} />;
	return (
		<MediaList data={data ?? []} cardType={cardType} defaultMediatype="tv" />
	);
}

function ContinueWatching() {
	const { items } = useContinueWatching();

	if (items.length === 0) return null;

	return <ContinueWatchingContent items={items} />;
}

function ContinueWatchingContent({
	items,
}: {
	items: { id: string; type: "movie" | "tv"; percent: number }[];
}) {
	const queries = items.map((item) => ({
		queryKey: ["continue-watching", item.id, item.type],
		queryFn: () =>
			item.type === "movie"
				? getBasicMovieDetails({ id: Number(item.id) })
				: getBasicTvDetails({ id: Number(item.id) }),
		staleTime: 1000 * 60 * 30,
	}));

	const results = useQueries({ queries });

	const isLoading = results.some((r) => r.isLoading);
	const hasError = results.some((r) => r.isError);

	if (isLoading) return <MediaSkeletonList cardType="horizontal" />;
	if (hasError) return null;

	const mediaItems = results
		.map((r, i) => {
			const data = r.data;
			const item = items[i];
			if (!data) return null;

			const isMovie = item.type === "movie";
			return {
				id: data.id,
				title: isMovie ? (data as any).title : (data as any).name,
				vote_average: (data as any).vote_average ?? 0,
				poster_path: (data as any).poster_path ?? "",
				first_air_date: isMovie ? undefined : (data as any).first_air_date,
				release_date: isMovie ? (data as any).release_date : undefined,
				overview: (data as any).overview,
				media_type: item.type,
				isContinueWatching: true,
			};
		})
		.filter(Boolean) as MediaListProps[];

	if (mediaItems.length === 0) return null;

	return <MediaList data={mediaItems} cardType="horizontal" />;
}

export {
	TrendingDayMovies,
	TrendingWeekMovies,
	UpcomingMovies,
	PopularMovies,
	PopularTv,
	TopRatedMovies,
	TopRatedTv,
	ContinueWatching,
};
