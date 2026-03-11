import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { MediaVideoImageContainer } from "@/components/media/media-video-image-container";
import { ShareButton } from "@/components/share-button";
import { VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getBasicMovieDetails } from "@/lib/queries";
import { formatMediaTitle, parseAndValidateId } from "@/lib/utils";

export const Route = createFileRoute("/movie/$id/{-$slug}/media")({
	loader: async ({ params }) => {
		const { id, slug } = params;
		if (!parseAndValidateId(id).success) {
			throw notFound();
		}
		const title = formatMediaTitle.decode(slug ?? "");
		return { id, slug, title };
	},
	head: ({ loaderData }) => ({
		meta: [
			...MetaImageTagsGenerator({
				title: loaderData?.title
						? `${loaderData.title} - Media | Pebbly`
						: "Page Not Found | Pebbly",
				description: loaderData?.title
					? `Watch the latest videos and images of ${loaderData.title}.`
						: "Explore the latest movie videos and images on Pebbly.",
				url:
					loaderData?.id &&
					loaderData?.title &&
					`${VITE_PUBLIC_APP_URL}/movie/${loaderData.id}/${encodeURIComponent(loaderData.title)}/media`,
			}),
		],
	}),
	validateSearch: (search: Record<string, unknown>) => {
		return {
			video: search.video as string | undefined,
			backdrop: search.backdrop as string | undefined,
			poster: search.poster as string | undefined,
		};
	},
	component: MovieMediaPage,
});

function MovieMediaPage() {
	const { id, slug, title } = Route.useLoaderData();
	const { data, isLoading } = useQuery({
		queryKey: ["basic_movie-details", id],
		queryFn: async () => await getBasicMovieDetails({ id: parseInt(id, 10) }),
		enabled: !!id,
	});

	useCanonicalSlugRedirect({
		entity: "movie",
		subPageEntity: "media",
		id: data?.id,
		title: data?.title ?? data?.original_title,
		incomingPathname: `/movie/${id}/${slug}/media`,
		isLoading,
	});
	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data) {
		return <DefaultNotFoundComponent />;
	}

	return (
		<section className="mx-auto block max-w-screen-xl items-center px-4">
			<div className="space-y-3 py-5">
				<div className="flex items-center justify-between gap-3">
					<GoBack link={`/movie/${id}/${slug}`} title="Back to main" />
					<ShareButton />
				</div>
				<h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
					{title}
				</h1>
			</div>
			<MediaVideoImageContainer id={parseInt(id, 10)} media_type="movie" />
		</section>
	);
}
