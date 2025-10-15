import { useQuery } from "@tanstack/react-query";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";

import {
	getMovieRecommendations,
	getTvSeriesRecommendations,
} from "@/lib/queries";

export const MediaRecomendations = (props: {
	id: number;
	urltitle: string;
	type: "movie" | "tv";
}) => {
	const { id, type } = props;
	const {
		data: movie_data,
		isLoading: movie_is_loading,
		isError: movie_is_error,
	} = useQuery({
		queryKey: ["recomendations", id],
		queryFn: async () => await getMovieRecommendations({ id }),
		enabled: type === "movie",
	});
	const {
		data: tv_data,
		isLoading: tv_is_loading,
		isError: tv_is_error,
	} = useQuery({
		queryKey: ["recomendations", id],
		queryFn: async () => await getTvSeriesRecommendations({ id: id }),
		enabled: type === "tv",
	});
	const isLoading = movie_is_loading || tv_is_loading;
	const isError = movie_is_error || tv_is_error;
	if (isLoading || isError) {
		return (
			<ScrollContainer isButtonsVisible={false}>
				<div className="flex gap-4 p-4 first:pl-0 last:pr-0">
					{Array.from({ length: 6 }).map((_, index) => (
						<MediaCardSkeleton key={index} card_type="vertical" />
					))}
				</div>
			</ScrollContainer>
		);
	}
	const hasMediaRecomendations =
		(movie_data && movie_data?.length > 0) || (tv_data && tv_data?.length > 0);
	if (!hasMediaRecomendations) return null;
	return (
		<div className="pb-5">
			<div className="flex flex-col gap-3">
				<span className="w-fit text-xl font-semibold md:text-2xl">
					Recommendations
				</span>
				<ScrollContainer isButtonsVisible={!movie_is_loading}>
					<div className="flex gap-4 p-4 first:pl-0 last:pr-0">
						{type === "movie"
							? movie_data?.map((item) => (
									<MediaCard
										key={item.id}
										card_type="vertical"
										id={item.id}
										image={item.backdrop_path}
										media_type="movie"
										poster_path={item.poster_path}
										rating={item.vote_average}
										release_date={item.release_date}
										title={item.title}
									/>
								))
							: tv_data?.map((item) => (
									<MediaCard
										key={item.id}
										card_type="vertical"
										id={item.id}
										image={item.backdrop_path}
										media_type="tv"
										poster_path={item.poster_path}
										rating={item.vote_average}
										release_date={item.first_air_date}
										title={item.name}
									/>
								))}
					</div>
				</ScrollContainer>
			</div>
		</div>
	);
};
