import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { DefaultLoader } from "@/components/default-loader";
import { CastSection } from "@/components/media/cast-section";
import { CurrentSeason } from "@/components/media/current-season";
import { GenreContainer } from "@/components/media/genre-container";
import { MediaContainer } from "@/components/media/media-container";
import { MediaDescription } from "@/components/media/media-description";
import { MediaKeywords } from "@/components/media/media-keywords";
import { MediaPosterTrailerContainer } from "@/components/media/media-poster-trailer-container";
import { MediaRecomendations } from "@/components/media/media-recommendation";
import { MediaTitleContailer } from "@/components/media/media-title-container";
import { GENRE_LIST, IMAGE_PREFIX } from "@/constants";
import { env } from "@/env";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
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
				title: `${loaderData?.title} | Film Fanatic`,
				description: `Explore detailed information about this movie, including cast, crew, reviews, and more about ${loaderData?.title}.`,
				ogImage: `${env.VITE_PUBLIC_APP_URL}/api/metaimage?id=${encodeURIComponent(loaderData?.id ?? "")}&type=tv`,
				url: `${env.VITE_PUBLIC_APP_URL}/tv/${loaderData?.id}/${encodeURIComponent(loaderData?.title ?? "")}`,
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
		incomingPathname: `/movie/${tv_id}/${tv_slug}`,
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
	const tvimage =
		poster_path && poster_path !== "" && poster_path !== null
			? `${IMAGE_PREFIX.HD_POSTER}${poster_path}`
			: `https://placehold.co/300x450?text=Image+Not+Found`;
	const tvreleaseyear = release_date
		? new Date(release_date).getFullYear()
		: null;

	const uscertification =
		content_ratings?.results?.find((result) => result.iso_3166_1 === "US")
			?.rating ?? "NR";

	const tvgenres = genres
		? genres
				.map((genre) => {
					return GENRE_LIST.find(
						(genreListItem) => genreListItem.id === genre.id,
					);
				})
				.filter((genre) => genre !== undefined)
		: [];

	const youtubevideos =
		videos?.results?.map((video) => ({
			key: video.key,
			name: video.name,
			type: video.type,
			published_at: video.published_at,
			official: video.official,
		})) ?? [];

	// get only the trailers from the youtube videos type = "Trailer" || "Teaser"
	const trailervideos = youtubevideos
		?.filter((video) => video.type === "Trailer" || video.type === "Teaser")
		.sort((a) => {
			return a.type === "Trailer" ? -1 : 1;
		});
	const youtubeclips = youtubevideos
		.filter((video) => video.type !== "Trailer" && video.type !== "Teaser")
		.sort((a, b) => {
			// First sort by type (Featurette takes priority)
			if (a.type !== b.type) {
				return a.type === "Featurette" ? -1 : 1;
			}

			// Then sort by published date (newest first)
			return (
				new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
			);
		})
		.slice(0, 10); // Slice after sorting to get the top 10

	const tvcast =
		credits?.cast
			?.map((cast) => ({
				id: cast.id,
				name: cast.name,
				profile_path: cast.profile_path,
				character: cast.character,
			}))
			.slice(0, 10) ?? [];
	const tvcrew =
		credits?.crew
			?.map((crew) => ({
				id: crew.id,
				name: crew.name,
				profile_path: crew.profile_path,
				job: crew.job,
			}))
			.slice(0, 10) ?? [];

	const tvbackdrops =
		images?.backdrops
			?.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
			.map((image) => ({
				backdrop_image: `${IMAGE_PREFIX.SD_BACKDROP}${image.file_path}`,
				backdrop_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
				aspect_ratio: image.aspect_ratio,
			}))
			.slice(0, 10) ?? [];

	const tvposters =
		images?.posters
			?.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
			.slice(0, 10)
			.map((image) => ({
				poster_image: `${IMAGE_PREFIX.SD_POSTER}${image.file_path}`,
				poster_image_raw: `${IMAGE_PREFIX.ORIGINAL}${image.file_path}`,
				aspect_ratio: image.aspect_ratio,
			}))
			.slice(0, 10) ?? [];

	const tvkeywords =
		keywords?.results?.map((keyword) => ({
			name: keyword.name,
			id: keyword.id,
		})) ?? [];

	const latestSeason =
		data.seasons
			?.slice()
			.reverse()
			.find(
				(season) =>
					season.air_date &&
					new Date(season.air_date).getTime() <= new Date().getTime(),
			) ?? data.seasons?.[data.seasons.length - 1];

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
			{latestSeason && (
				<CurrentSeason id={id} season_data={latestSeason} urltitle={urltitle} />
			)}
			<MediaContainer
				backdrops={tvbackdrops}
				id={id}
				is_more_backdrops_available={(images?.backdrops?.length ?? 0) > 10}
				is_more_clips_available={youtubevideos.length > 10}
				is_more_posters_available={(images?.posters?.length ?? 0) > 10}
				posters={tvposters}
				title={tvtitle}
				type="tv"
				urltitle={urltitle}
				youtubeclips={youtubeclips}
			/>
			{keywords && <MediaKeywords keywords={tvkeywords} />}
			<MediaRecomendations id={id} type="tv" urltitle={urltitle} />
		</section>
	);
}
