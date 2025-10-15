import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { MediaCreditSection } from "@/components/media/media-credit-section";
import { ShareButton } from "@/components/share-button";
import { env } from "@/env";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getBasicMovieDetails } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";

export const Route = createFileRoute("/movie/$id/{-$slug}/cast-crew")({
	loader: async ({ params }) => {
		const { id, slug } = params;
		if (!isValidId(parseInt(id, 10))) {
			throw notFound();
		}
		const title = formatMediaTitle.decode(slug ?? "");
		return { id, slug, title };
	},
	head: ({ loaderData }) => ({
		meta: [
			...MetaImageTagsGenerator({
				title: `${loaderData?.title} - Cast & Crew | Film Fanatic`,
				description: `Explore the cast and crew of  ${loaderData?.title}`,
				url: `${env.VITE_PUBLIC_APP_URL}/movie/${loaderData?.id}/${encodeURIComponent(loaderData?.title ?? "")}/cast-crew`,
			}),
		],
	}),
	component: MovieCastAndCrewPage,
});

function MovieCastAndCrewPage() {
	const { id, slug, title } = Route.useLoaderData();
	const { data, isLoading } = useQuery({
		queryKey: ["basic_movie-details", id],
		queryFn: async () => await getBasicMovieDetails({ id: parseInt(id, 10) }),
		enabled: !!id,
	});

	useCanonicalSlugRedirect({
		entity: "movie",
		subPageEntity: "cast-crew",
		id: data?.id,
		title: data?.title ?? data?.original_title,
		incomingPathname: `/movie/${id}/${slug}/cast-crew`,
		isLoading,
	});
	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data) {
		throw notFound();
	}
	return (
		<section className="mx-auto block max-w-screen-xl items-center px-4">
			<div className="space-y-3 py-5">
				<div className="flex items-center justify-between">
					<GoBack link={`/movie/${id}/${slug}`} title="Back to main" />
					<ShareButton />
				</div>
				<h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
					{title}
				</h1>
			</div>
			<MediaCreditSection id={parseInt(id, 10)} type="movie" />
		</section>
	);
}
