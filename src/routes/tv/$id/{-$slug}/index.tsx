import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { CastSection } from "@/components/media/cast-section";
import { GenreContainer } from "@/components/media/genre-container";
import { InlineEpisodeBrowser } from "@/components/media/inline-episode-browser";
import { MediaContainer } from "@/components/media/media-container";
import { MediaDescription } from "@/components/media/media-description";
import { MediaKeywords } from "@/components/media/media-keywords";
import { MediaPosterTrailerContainer } from "@/components/media/media-poster-trailer-container";
import { MediaRecommendations } from "@/components/media/media-recommendation";
import { MediaTitleContainer } from "@/components/media/media-title-container";
import { VITE_PUBLIC_APP_URL } from "@/constants";

import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { buildSharedMediaPageData } from "@/lib/media-page";
import { getTvCertification } from "@/lib/media-transform";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getTvDetails } from "@/lib/queries";
import { formatMediaTitle, parseAndValidateId } from "@/lib/utils";
import type { Tv } from "@/types";

export const Route = createFileRoute("/tv/$id/{-$slug}/")({
	loader: async ({ params }) => {
		const { id, slug } = params;
		if (!parseAndValidateId(id).success) {
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
	validateSearch: (search: Record<string, unknown>) => {
		return {
			trailer: search.trailer as string | undefined,
		};
	},
	component: TvHomePage,
});

function TvHomePage() {
	const { id: tv_id, slug: tv_slug } = Route.useLoaderData();
	const tv_id_param = parseInt(tv_id, 10);
	const { data, error, isLoading } = useQuery<Tv>({
		queryKey: ["tv_details", tv_id_param],
		queryFn: () => getTvDetails({ id: tv_id_param }),
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
		return <DefaultNotFoundComponent />;
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

	const mediaPage = buildSharedMediaPageData({
		title: name,
		originalTitle: original_name,
		posterPath: poster_path,
		releaseDate: release_date,
		genres,
		images,
		credits,
		videos,
	});
	const imdb_url = imdb_id ? `https://www.imdb.com/title/${imdb_id}` : null;

	const uscertification = getTvCertification(content_ratings?.results);
	const tvkeywords =
		keywords?.results?.map((keyword) => ({
			name: keyword.name,
			id: keyword.id,
		})) ?? [];

	return (
		<section className="mx-auto block max-w-screen-xl items-center px-4">
			<MediaTitleContainer
				runtime={null}
				description={`${overview?.slice(0, 100)}...`}
				id={id}
				image={mediaPage.image}
				imdb_url={imdb_url}
				media_type="tv"
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
				tv_status={status}
				uscertification={uscertification}
				vote_average={vote_average}
				vote_count={vote_count}
			/>
			<MediaPosterTrailerContainer
				tmdbId={id}
				type="tv"
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
				type="tv"
				urltitle={mediaPage.urltitle}
			/>
			{data.seasons && data.seasons.length > 0 && (
				<InlineEpisodeBrowser
					tvId={id}
					showName={mediaPage.displayTitle}
					seasons={data.seasons}
					image={mediaPage.image}
					release_date={release_date}
					overview={overview}
					rating={vote_average}
					status={status}
				/>
			)}
			<MediaContainer
				backdrops={mediaPage.backdrops}
				id={id}
				is_more_backdrops_available={(images?.backdrops?.length ?? 0) > 10}
				is_more_clips_available={mediaPage.allVideos.length > 10}
				is_more_posters_available={(images?.posters?.length ?? 0) > 10}
				posters={mediaPage.posters}
				title={mediaPage.displayTitle}
				type="tv"
				urltitle={mediaPage.urltitle}
				youtubeclips={mediaPage.youtubeclips}
			/>
			{keywords && <MediaKeywords keywords={tvkeywords} />}
			<MediaRecommendations id={id} type="tv" urltitle={mediaPage.urltitle} />
		</section>
	);
}
