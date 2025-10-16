import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { MediaCreditSection } from "@/components/media/media-credit-section";
import { VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getBasicTvDetails } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";

export const Route = createFileRoute("/tv/$id/{-$slug}/cast-crew")({
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
				title: loaderData?.title
					? `${loaderData.title} - Cast & Crew | Film Fanatic`
					: "Page Not Found | Film Fanatic",
				description: loaderData?.title
					? `Explore the cast and crew of ${loaderData.title}.`
					: "Discover the cast and crew of your favorite shows on Film Fanatic.",
				url:
					loaderData?.id &&
					loaderData?.title &&
					`${VITE_PUBLIC_APP_URL}/tv/${loaderData.id}/${encodeURIComponent(loaderData.title)}/cast-crew`,
			}),
		],
	}),
	component: TvCastAndCrewPage,
});

function TvCastAndCrewPage() {
	const { id, slug, title } = Route.useLoaderData();
	const { data, isLoading } = useQuery({
		queryKey: ["basic_tv-details", id],
		queryFn: async () => await getBasicTvDetails({ id: parseInt(id, 10) }),
		enabled: !!id,
	});

	useCanonicalSlugRedirect({
		entity: "tv",
		subPageEntity: "cast-crew",
		id: data?.id,
		title: data?.name ?? data?.name,
		incomingPathname: `/tv/${id}/${slug}/cast-crew`,
		isLoading,
	});
	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data) {
		throw notFound();
	}
	return (
		<MediaCreditSection
			id={parseInt(id, 10)}
			slug={slug as string}
			title={title}
			type="tv"
		/>
	);
}
