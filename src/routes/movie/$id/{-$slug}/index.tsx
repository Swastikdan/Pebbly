import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { CastSection } from "@/components/media/cast-section";
import { Collections } from "@/components/media/collections";
import { GenreContainer } from "@/components/media/genre-container";
import { MediaContainer } from "@/components/media/media-container";
import { MediaDescription } from "@/components/media/media-description";
import { MediaKeywords } from "@/components/media/media-keywords";
import { MediaPosterTrailerContainer } from "@/components/media/media-poster-trailer-container";
import { MediaRecommendations } from "@/components/media/media-recommendation";
import { MediaTitleContailer } from "@/components/media/media-title-container";
import { VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import {
	formatRuntime,
	getMovieCertification,
	getPosterImage,
	mapBackdrops,
	mapCast,
	mapCrew,
	mapGenres,
	mapPosters,
	splitVideos,
} from "@/lib/media-transform";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getMovieDetails } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";
import type { Movie } from "@/types";

export const Route = createFileRoute("/movie/$id/{-$slug}/")({
	loader: async ({ params }) => {
		const { id, slug } = params;
		if (!isValidId(parseInt(id, 10))) {
			throw notFound();
		}
		const title = slug ? formatMediaTitle.decode(slug) : "Movie Page";
		return { id, slug, title };
	},
	head: ({ loaderData }) => ({
		meta: [
			...MetaImageTagsGenerator({
				title: loaderData?.title
					? `${loaderData.title} | Film Fanatic`
					: "Page Not Found | Film Fanatic",
				description: loaderData?.title
					? `Explore detailed information about ${loaderData.title}, including cast, crew, reviews, and more.`
					: "Explore detailed information about movies on Film Fanatic.",
				ogImage:
					loaderData?.id &&
					`${VITE_PUBLIC_APP_URL}/api/metaimage?id=${encodeURIComponent(loaderData?.id ?? "")}&type=movie`,
				url:
					loaderData?.id &&
					loaderData?.title &&
					`${VITE_PUBLIC_APP_URL}/movie/${loaderData.id}/${encodeURIComponent(loaderData.title)}`,
			}),
		],
	}),
	component: MovieHomePage,
});

function MovieHomePage() {
	const { id: movie_id, slug: movie_slug } = Route.useLoaderData();
	const movie_id_param = parseInt(movie_id, 10);
	const { data, error, isLoading } = useQuery<Movie>({
		queryKey: ["movie_details", movie_id_param],
		queryFn: async () => await getMovieDetails({ id: movie_id_param }),
	});
	useCanonicalSlugRedirect({
		entity: "movie",
		subPageEntity: "home",
		id: data?.id,
		title: data?.title ?? data?.original_title,
		incomingPathname: `/movie/${movie_id}/${movie_slug}`,
		isLoading,
	});
	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data || error) {
		throw notFound();
	}

	const {
		belongs_to_collection,
		genres,
		id,
		imdb_id,
		original_title,
		overview,
		poster_path,
		release_date,
		runtime,
		tagline,
		title,
		vote_average,
		vote_count,
		images,
		credits,
		videos,
		release_dates,
		keywords,
	} = data;

	const urltitle = formatMediaTitle.encode(title);
	const imdb_url = imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null;
	const movietitle = title ?? original_title;
	const movieimage = getPosterImage(poster_path);
	const moviereleaseyear = release_date
		? new Date(release_date).getFullYear()
		: null;

	const uscertification = getMovieCertification(release_dates?.results);
	const movieRuntime = formatRuntime(runtime);
	const moviegenres = mapGenres(genres);
	const { normalizedVideos, trailervideos, youtubeclips } = splitVideos(
		videos?.results,
	);
	const moviecast = mapCast(credits?.cast);
	const moviecrew = mapCrew(credits?.crew);
	const moviebackdrops = mapBackdrops(images?.backdrops);
	const movieposters = mapPosters(images?.posters);

	const moviekeywords =
		keywords?.keywords?.map((k) => ({ name: k.name, id: k.id })) ?? [];
	return (
		<section className="mx-auto block max-w-screen-xl items-center px-4">
			<MediaTitleContailer
				runtime={movieRuntime ?? null}
				description={`${overview?.slice(0, 100)}...`}
				id={id}
				image={movieimage}
				imdb_url={imdb_url}
				media_type="movie"
				poster_path={poster_path}
				rateing={vote_average}
				releaseyear={String(moviereleaseyear) || "Not Released"}
				release_date={release_date}
				tagline={tagline ?? null}
				title={movietitle}
				uscertification={uscertification}
				vote_average={vote_average}
				vote_count={vote_count}
			/>
			<MediaPosterTrailerContainer
				tmdbId={id}
				type="movie"
				image={movieimage}
				title={movietitle}
				trailervideos={trailervideos}
			/>
			<GenreContainer genres={moviegenres} />
			<MediaDescription description={overview} />
			<CastSection
				cast={moviecast}
				crew={moviecrew}
				id={id}
				is_more_cast_crew={
					(credits?.cast?.length ?? 0) > 10 || (credits?.crew?.length ?? 0) > 10
				}
				type="movie"
				urltitle={urltitle}
			/>
			<MediaContainer
				backdrops={moviebackdrops}
				id={id}
				is_more_backdrops_available={(images?.backdrops?.length ?? 0) > 10}
				is_more_clips_available={normalizedVideos.length > 10}
				is_more_posters_available={(images?.posters?.length ?? 0) > 10}
				posters={movieposters}
				title={movietitle}
				type="movie"
				urltitle={urltitle}
				youtubeclips={youtubeclips}
			/>
			{belongs_to_collection && <Collections id={belongs_to_collection.id} />}
			{keywords && <MediaKeywords keywords={moviekeywords} />}
			<MediaRecommendations id={id} type="movie" urltitle={urltitle} />
		</section>
	);
}
