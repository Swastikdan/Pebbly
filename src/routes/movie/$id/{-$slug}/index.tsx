import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { CastSection } from "@/components/media/cast-section";
import { Collections } from "@/components/media/collections";
import { GenreContainer } from "@/components/media/genre-container";
import { MediaContainer } from "@/components/media/media-container";
import { MediaDescription } from "@/components/media/media-description";
import { MediaKeywords } from "@/components/media/media-keywords";
import { MediaPosterTrailerContainer } from "@/components/media/media-poster-trailer-container";
import { MediaRecommendations } from "@/components/media/media-recommendation";
import { MediaTitleContainer } from "@/components/media/media-title-container";
import { VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { buildSharedMediaPageData } from "@/lib/media-page";
import { formatRuntime, getMovieCertification } from "@/lib/media-transform";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getMovieDetails } from "@/lib/queries";
import { formatMediaTitle, parseAndValidateId } from "@/lib/utils";
import type { Movie } from "@/types";

export const Route = createFileRoute("/movie/$id/{-$slug}/")({
	loader: async ({ params }) => {
		const { id, slug } = params;
		const parsed = parseAndValidateId(id);
		if (!parsed.success) {
			throw notFound();
		}
		const title = slug ? formatMediaTitle.decode(slug) : "Movie Page";
		return { id, slug, title };
	},
	head: ({ loaderData }) => ({
		meta: [
			...MetaImageTagsGenerator({
				title: loaderData?.title
						? `${loaderData.title} | Pebbly`
						: "Page Not Found | Pebbly",
				description: loaderData?.title
					? `Explore detailed information about ${loaderData.title}, including cast, crew, reviews, and more.`
						: "Explore detailed information about movies on Pebbly.",
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
	validateSearch: (search: Record<string, unknown>) => {
		return {
			trailer: search.trailer as string | undefined,
		};
	},
	component: MovieHomePage,
});

function MovieHomePage() {
	const { id: movie_id, slug: movie_slug } = Route.useLoaderData();
	const movie_id_param = parseInt(movie_id, 10);
	const { data, error, isLoading } = useQuery<Movie>({
		queryKey: ["movie_details", movie_id_param],
		queryFn: () => getMovieDetails({ id: movie_id_param }),
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
		return <DefaultNotFoundComponent />;
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

	const mediaPage = buildSharedMediaPageData({
		title,
		originalTitle: original_title,
		posterPath: poster_path,
		releaseDate: release_date,
		genres,
		images,
		credits,
		videos,
	});
	const imdb_url = imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null;
	const uscertification = getMovieCertification(release_dates?.results);
	const movieRuntime = formatRuntime(runtime);
	const moviekeywords =
		keywords?.keywords?.map((k) => ({ name: k.name, id: k.id })) ?? [];
	return (
		<section className="mx-auto block max-w-screen-xl items-center px-4">
			<MediaTitleContainer
				runtime={movieRuntime ?? null}
				description={`${overview?.slice(0, 100)}...`}
				id={id}
				image={mediaPage.image}
				imdb_url={imdb_url}
				media_type="movie"
				poster_path={poster_path}
				rating={vote_average}
				releaseyear={
				mediaPage.releaseYear != null && Number.isFinite(mediaPage.releaseYear)
					? String(mediaPage.releaseYear)
					: "Not Released"
			}
				release_date={release_date}
				tagline={tagline ?? null}
				title={mediaPage.displayTitle}
				uscertification={uscertification}
				vote_average={vote_average}
				vote_count={vote_count}
			/>
			<MediaPosterTrailerContainer
				tmdbId={id}
				type="movie"
				image={mediaPage.image}
				title={mediaPage.displayTitle}
				trailervideos={mediaPage.trailervideos}
			/>
			<GenreContainer genres={mediaPage.genres} />
			<MediaDescription description={overview} />
			<CastSection
				cast={mediaPage.cast}
				crew={mediaPage.crew}
				id={id}
				is_more_cast_crew={
					(credits?.cast?.length ?? 0) > 10 || (credits?.crew?.length ?? 0) > 10
				}
				type="movie"
				urltitle={mediaPage.urltitle}
			/>
			<MediaContainer
				backdrops={mediaPage.backdrops}
				id={id}
				is_more_backdrops_available={(images?.backdrops?.length ?? 0) > 10}
				is_more_clips_available={mediaPage.allVideos.length > 10}
				is_more_posters_available={(images?.posters?.length ?? 0) > 10}
				posters={mediaPage.posters}
				title={mediaPage.displayTitle}
				type="movie"
				urltitle={mediaPage.urltitle}
				youtubeclips={mediaPage.youtubeclips}
			/>
			{belongs_to_collection && <Collections id={belongs_to_collection.id} />}
			{keywords && <MediaKeywords keywords={moviekeywords} />}
			<MediaRecommendations
				id={id}
				type="movie"
				urltitle={mediaPage.urltitle}
			/>
		</section>
	);
}
