import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { MediaImages } from "@/components/media/media-images";
import { MediaVideos } from "@/components/media/media-videos";
import { ShareButton } from "@/components/share-button";
import { env } from "@/env";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getBasicTvDetails } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";

export const Route = createFileRoute("/tv/$id/{-$slug}/media")({
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
				title: `${loaderData?.title} - Media | Film Fanatic`,
				description: `Watch the latest videos and images of ${loaderData?.title}`,
				url: `${env.VITE_PUBLIC_APP_URL}/tv/${loaderData?.id}/${encodeURIComponent(loaderData?.title ?? "")}/media`,
			}),
		],
	}),
	component: TvMediaPage,
});

function TvMediaPage() {
	const { id, slug, title } = Route.useLoaderData();
	const { data, isLoading } = useQuery({
		queryKey: ["basic_tv-details", id],
		queryFn: async () => await getBasicTvDetails({ id: parseInt(id, 10) }),
		enabled: !!id,
	});

	useCanonicalSlugRedirect({
		entity: "tv",
		subPageEntity: "media",
		id: data?.id,
		title: data?.name ?? data?.original_name,
		incomingPathname: `/tv/${id}/${slug}/media`,
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
					<GoBack link={`/tv/${id}/${slug}`} title="Back to main" />
					<ShareButton />
				</div>
				<h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
					{title}
				</h1>
			</div>

			<div className="flex flex-col gap-5 py-3">
				<span className="w-fit text-xl font-semibold md:text-2xl">Videos</span>
				<MediaVideos id={parseInt(id, 10)} media_type="tv" />
			</div>
			<div className="flex flex-col gap-5 py-3 pb-32">
				<span className="w-fit text-xl font-semibold md:text-2xl">Images</span>
				<MediaImages id={parseInt(id, 10)} media_type="tv" />
			</div>
		</section>
	);
}
