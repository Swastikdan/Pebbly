import { useUser } from "@clerk/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { MediaCard } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
import { useContinueWatching } from "@/hooks/watch-progress/use-watch-progress";
import {
	getBasicMovieDetails,
	getBasicTvDetails,
	getMedia,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import type {
	BasicMovie,
	BasicTv,
	MediaListResultsEntity,
} from "@/lib/tmdb-schemas";

interface MediaListProps extends MediaListResultsEntity {
	is_on_watchlist_page?: boolean;
	is_on_homepage?: boolean;
	isContinueWatching?: boolean;
}
const MediaList = memo(
	(props: {
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
							priority={
								props.priorityCount ? index < props.priorityCount : false
							}
						/>
					))}
				</div>
			</ScrollContainer>
		);
	},
);

import { MediaSkeletonList } from "@/components/ui/media-skeleton-list";

export { MediaSkeletonList };

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
		queryKey: queryKeys.tmdb.homepageMedia(type),
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

function MediaSection({
	queryType,
	cardTypeOverride,
	mediaType,
	priorityCount,
}: {
	queryType:
		| "trending_day"
		| "trending_week"
		| "movies_upcoming"
		| "movies_popular"
		| "tv-shows_popular"
		| "movies_top-rated"
		| "tv-shows_top-rated";
	cardTypeOverride?: "horizontal" | "vertical";
	mediaType?: "movie" | "tv";
	priorityCount?: number;
}) {
	const { data, error, cardType } = useMediaQuery(queryType, {
		cardType: cardTypeOverride,
		mediaType,
	});

	if (!data || error) return <MediaSkeletonList cardType={cardType} />;
	return (
		<MediaList
			data={data ?? []}
			cardType={cardType}
			defaultMediatype={mediaType}
			priorityCount={priorityCount}
		/>
	);
}

function TrendingDayMovies() {
	return <MediaSection queryType="trending_day" priorityCount={2} />;
}

function TrendingWeekMovies() {
	return <MediaSection queryType="trending_week" />;
}

function UpcomingMovies() {
	const { items } = useContinueWatching();
	const { isSignedIn } = useUser();
	const showContinueWatching = isSignedIn && items.length > 0;
	const resolvedCardType = showContinueWatching ? "horizontal" : "vertical";

	return (
		<MediaSection
			queryType="movies_upcoming"
			cardTypeOverride={resolvedCardType}
			mediaType="movie"
		/>
	);
}

function PopularMovies() {
	return <MediaSection queryType="movies_popular" mediaType="movie" />;
}

function PopularTv() {
	return <MediaSection queryType="tv-shows_popular" mediaType="tv" />;
}

function TopRatedMovies() {
	return <MediaSection queryType="movies_top-rated" mediaType="movie" />;
}

function TopRatedTv() {
	return <MediaSection queryType="tv-shows_top-rated" mediaType="tv" />;
}

function ContinueWatching() {
	const { items } = useContinueWatching();

	if (items.length === 0) return null;

	return <ContinueWatchingContent items={items} />;
}

function ContinueWatchingContent({
	items,
}: {
	items: {
		id: string;
		type: "movie" | "tv";
		percent: number;
		title?: string;
		image?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
	}[];
}) {
	const queries = items.map((item) => ({
		queryKey: queryKeys.tmdb.continueWatching(item.id, item.type),
		queryFn: () =>
			item.type === "movie"
				? getBasicMovieDetails({ id: Number(item.id) })
				: getBasicTvDetails({ id: Number(item.id) }),
		staleTime: 1000 * 60 * 30,
		enabled: !item.title || !item.overview,
	}));

	const results = useQueries({ queries });

	const isLoading = results.some((r, i) => queries[i].enabled && r.isLoading);
	const hasError = results.some((r, i) => queries[i].enabled && r.isError);

	if (isLoading) return <MediaSkeletonList cardType="vertical" />;
	if (hasError) return null;

	const mediaItems = results
		.map((r, i) => {
			const data = r.data;
			const item = items[i];

			const title =
				item.title ??
				(data
					? item.type === "movie"
						? (data as BasicMovie).title
						: (data as BasicTv).name
					: undefined);
			const overview = item.overview ?? data?.overview;

			// Skip items missing required fields
			if (!title || !overview) return null;

			const raw = data as unknown as Record<string, unknown>;
			const result: MediaListProps = {
				id: Number(item.id),
				title,
				vote_average: item.rating ?? (raw?.vote_average as number) ?? 0,
				vote_count: (raw?.vote_count as number) ?? 0,
				poster_path: item.image ?? (raw?.poster_path as string) ?? "",
				backdrop_path: item.image ?? (raw?.backdrop_path as string) ?? "",
				overview,
				media_type: item.type,
				adult: (raw?.adult as boolean) ?? false,
				original_language: (raw?.original_language as string) ?? "",
				popularity: (raw?.popularity as number) ?? 0,
				video: (raw?.video as boolean) ?? false,
				isContinueWatching: true,
			};

			return result;
		})
		.filter(Boolean) as MediaListProps[];

	if (mediaItems.length === 0) return null;

	return <MediaList data={mediaItems} cardType="vertical" />;
}

export {
	ContinueWatching,
	PopularMovies,
	PopularTv,
	TopRatedMovies,
	TopRatedTv,
	TrendingDayMovies,
	TrendingWeekMovies,
	UpcomingMovies,
};
