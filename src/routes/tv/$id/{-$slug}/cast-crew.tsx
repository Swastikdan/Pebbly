import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { MediaCreditSection } from "@/components/media/media-credit-section";
import { IMAGE_PREFIX, VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getBasicTvDetails } from "@/lib/queries";
import type { Tv } from "@/lib/tmdb-schemas";
import { formatMediaTitle, parseAndValidateId } from "@/lib/utils";

export const Route = createFileRoute("/tv/$id/{-$slug}/cast-crew")({
	loader: ({ params, context }) => {
		const { id, slug } = params;
		const parsed = parseAndValidateId(id);
		if (!parsed.success) {
			throw notFound();
		}
		context.queryClient.prefetchQuery({
			queryKey: ["basic_tv-details", id],
			queryFn: () => getBasicTvDetails({ id: parsed.data }),
		});
		const data = context.queryClient.getQueryData<Tv>(["basic_tv-details", id]);
		const title = formatMediaTitle.decode(slug ?? "");
		return { id, slug, title, posterPath: data?.poster_path ?? null };
	},
	head: ({ loaderData }) => ({
		meta: [
			...MetaImageTagsGenerator({
				title: loaderData?.title
					? `${loaderData.title} - Cast & Crew | Pebbly`
					: "Page Not Found | Pebbly",
				description: loaderData?.title
					? `Explore the cast and crew of ${loaderData.title}.`
					: "Discover the cast and crew of your favorite shows on Pebbly.",
				ogImage: loaderData?.posterPath
					? `${IMAGE_PREFIX.SD_POSTER}${loaderData.posterPath}`
					: undefined,
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
		return <DefaultNotFoundComponent />;
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
