import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { DefaultLoader } from "@/components/default-loader";
import { CastSection } from "@/components/media/cast-section";
import { GenreContainer } from "@/components/media/genre-container";
import { InlineEpisodeBrowser } from "@/components/media/inline-episode-browser";
import { MediaContainer } from "@/components/media/media-container";
import { MediaDescription } from "@/components/media/media-description";
import { MediaKeywords } from "@/components/media/media-keywords";
import { MediaPosterTrailerContainer } from "@/components/media/media-poster-trailer-container";
import { MediaRecommendations } from "@/components/media/media-recommendation";
import { MediaTitleContailer } from "@/components/media/media-title-container";
import { VITE_PUBLIC_APP_URL } from "@/constants";

import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import {
	getPosterImage,
	getTvCertification,
	mapBackdrops,
	mapCast,
	mapCrew,
	mapGenres,
	mapPosters,
	splitVideos,
} from "@/lib/media-transform";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getTvDetails } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";
import type { Tv } from "@/types";

export const Route = createFileRoute("/tv/$id/{-$slug}/")({
	loader: async ({ params }) => {
		const { id, slug } = params;
		if (!isValidId(parseInt(id, 10))) {
			throw notFound();
		}
		const title = slug ? formatMediaTitle.decode(slug) : "Tv Page";
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
					: "Explore detailed information about movies and shows on Film Fanatic.",
				ogImage:
					loaderData?.id &&
					`${VITE_PUBLIC_APP_URL}/api/metaimage?id=${encodeURIComponent(loaderData?.id ?? "")}&type=tv`,
				url:
					loaderData?.id &&
					loaderData?.title &&
					`${VITE_PUBLIC_APP_URL}/tv/${loaderData.id}/${encodeURIComponent(loaderData.title)}`,
			}),
		],
	}),
	component: TvHomePage,
});

function TvHomePage() {
	const { id: tv_id, slug: tv_slug } = Route.useLoaderData();
	const tv_id_param = parseInt(tv_id, 10);
	const { data, error, isLoading } = useQuery<Tv>({
		queryKey: ["tv_details", tv_id_param],
		queryFn: async () => await getTvDetails({ id: tv_id_param }),
	});

	useCanonicalSlugRedirect({
		entity: "tv",
		subPageEntity: "home",
		id: data?.id,
		title: data?.name ?? data?.original_name,
		incomingPathname: `/tv/${tv_id}/${tv_slug}`,
		isLoading,
	});
	if (isLoading) {
		return <DefaultLoader />;
	}
	if (!data || error) {
		throw notFound();
	}
	const {
		genres,
		id,
		external_ids: { imdb_id },
		original_name,
		overview,
		poster_path,
		first_air_date: release_date,
		content_ratings,
		tagline,
		name,
		vote_average,
		vote_count,
		images,
		credits,
		videos,
		status,
		keywords,
	} = data;

	const urltitle = formatMediaTitle.encode(name);

	const imdb_url = imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null;
	const tvtitle = name ?? original_name;
	const tvimage = getPosterImage(poster_path);
	const tvreleaseyear = release_date
		? new Date(release_date).getFullYear()
		: null;

	const uscertification = getTvCertification(content_ratings?.results);
	const tvgenres = mapGenres(genres);
	const { normalizedVideos, trailervideos, youtubeclips } = splitVideos(
		videos?.results,
	);
	const tvcast = mapCast(credits?.cast);
	const tvcrew = mapCrew(credits?.crew);
	const tvbackdrops = mapBackdrops(images?.backdrops);
	const tvposters = mapPosters(images?.posters);

	const tvkeywords =
		keywords?.results?.map((keyword) => ({
			name: keyword.name,
			id: keyword.id,
		})) ?? [];

	return (
		<section className="mx-auto block max-w-screen-xl items-center px-4">
			<MediaTitleContailer
				runtime={null}
				description={`${overview?.slice(0, 100)}...`}
				id={id}
				image={tvimage}
				imdb_url={imdb_url}
				media_type="tv"
				poster_path={poster_path}
				rateing={vote_average}
				releaseyear={String(tvreleaseyear) || "Not Released"}
				release_date={release_date}
				tagline={tagline ?? null}
				title={tvtitle}
				tv_status={status}
				uscertification={uscertification}
				vote_average={vote_average}
				vote_count={vote_count}
			/>
			<MediaPosterTrailerContainer
				tmdbId={id}
				type="tv"
				image={tvimage}
				title={tvtitle}
				trailervideos={trailervideos}
			/>
			<GenreContainer genres={tvgenres} />
			<MediaDescription description={overview} />
			<CastSection
				cast={tvcast}
				crew={tvcrew}
				id={id}
				is_more_cast_crew={
					(credits?.cast?.length ?? 0) > 10 || (credits?.crew?.length ?? 0) > 10
				}
				type="tv"
				urltitle={urltitle}
			/>
			{data.seasons && data.seasons.length > 0 && (
				<InlineEpisodeBrowser
					tvId={id}
					showName={tvtitle}
					seasons={data.seasons}
					image={tvimage}
					release_date={release_date}
					overview={overview}
					rating={vote_average}
				/>
			)}
			<MediaContainer
				backdrops={tvbackdrops}
				id={id}
				is_more_backdrops_available={(images?.backdrops?.length ?? 0) > 10}
				is_more_clips_available={normalizedVideos.length > 10}
				is_more_posters_available={(images?.posters?.length ?? 0) > 10}
				posters={tvposters}
				title={tvtitle}
				type="tv"
				urltitle={urltitle}
				youtubeclips={youtubeclips}
			/>
			{keywords && <MediaKeywords keywords={tvkeywords} />}
			<MediaRecommendations id={id} type="tv" urltitle={urltitle} />
		</section>
	);
}
