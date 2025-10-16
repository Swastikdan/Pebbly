import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { SeasonContainer } from "@/components/media/season-container";
import { ShareButton } from "@/components/share-button";

import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getBasicTvDetails } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";
import { VITE_PUBLIC_APP_URL } from "@/constants";

export const Route = createFileRoute("/tv/$id/{-$slug}/seasons")({
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
				url: `${VITE_PUBLIC_APP_URL}/tv/${loaderData?.id}/${encodeURIComponent(loaderData?.title ?? "")}/seasons`,
			}),
		],
	}),
	component: TvSeasonsPage,
});

function TvSeasonsPage() {
	const { id, slug, title } = Route.useLoaderData();
	const { data, isLoading } = useQuery({
		queryKey: ["basic_tv-details", id],
		queryFn: async () => await getBasicTvDetails({ id: parseInt(id, 10) }),
		enabled: !!id,
	});

	useCanonicalSlugRedirect({
		entity: "tv",
		subPageEntity: "seasons",
		id: data?.id,
		title: data?.name ?? data?.name,
		incomingPathname: `/tv/${id}/${slug}/seasons`,
		isLoading,
	});
	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data) {
		throw notFound();
	}
	return (
		<section className="mx-auto block min-h-[90vh] max-w-screen-xl items-center px-4">
			<div className="space-y-3 py-5">
				<div className="flex items-center justify-between">
					<GoBack link={`/tv/${id}/${slug}`} title="Back to main" />
					<ShareButton />
				</div>
				<h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
					{title}
				</h1>
			</div>
			<SeasonContainer tv_id={parseInt(id, 10)} />
		</section>
	);
}
