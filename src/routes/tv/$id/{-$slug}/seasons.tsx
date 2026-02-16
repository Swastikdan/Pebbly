import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX, VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getTvDetails } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";
import type { SeasonInfo } from "@/types";

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
				title: loaderData?.title
					? `${loaderData.title} - Seasons | Film Fanatic`
					: "Page Not Found | Film Fanatic",
				description: loaderData?.title
					? `All seasons of  ${loaderData.title}.`
					: "Explore all seasons of your favorite shows on Film Fanatic.",
				url:
					loaderData?.id &&
					loaderData.title &&
					`${VITE_PUBLIC_APP_URL}/tv/${loaderData.id}/${loaderData.slug}/seasons`,
			}),
		],
	}),
	component: TvSeasonsPage,
});

function TvSeasonsPage() {
	const { id, slug, title } = Route.useLoaderData();
	const { data, isLoading } = useQuery({
		queryKey: ["tv_details", id],
		queryFn: async () => await getTvDetails({ id: parseInt(id, 10) }),
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
	const seasons = data?.seasons?.slice() ?? [];
	const zeroSeason = seasons.find((season) => season.season_number === 0);

	if (zeroSeason) {
		seasons.splice(seasons.indexOf(zeroSeason), 1);
		seasons.push(zeroSeason);
	}

	const showName = data?.name ?? data?.original_name;
	const urltitle = formatMediaTitle.encode(showName);

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
			<div className="flex flex-col gap-5 py-5 pb-32">
				{seasons.map((season: SeasonInfo) => (
					<Link
						key={season.id}
						// @ts-expect-error - correct link
						to={`/tv/${id}/${urltitle}/season/${season.season_number}`}
						className="pressable-small block"
					>
						<div className="flex items-start gap-5 rounded-3xl border-2 border-default bg-secondary/10 p-3 transition-all duration-300 hover:border-foreground/20 hover:bg-secondary/20 hover: md:p-5">
							<div className="min-w-[7rem] md:min-w-[9rem]">
								<Image
									alt={season.name}
									className="h-40 w-28 shrink-0 rounded-xl object-cover md:h-52 md:w-36"
									height={300}
									src={IMAGE_PREFIX.HD_POSTER + season.poster_path}
									width={200}
								/>
							</div>
							<div className="flex flex-1 flex-col items-start justify-center gap-2 overflow-hidden py-3">
								<div className="line-clamp-1 text-xl font-bold transition-opacity duration-200 ease-in-out hover:opacity-90 md:text-2xl dark:hover:opacity-70">
									{season.name}
								</div>
								<div className="flex flex-wrap items-center gap-2">
									{season.vote_average > 0 && (
										<Badge
											className="rounded-lg px-3 w-min text-sm font-light"
											variant="secondary"
										>
											<span className="flex flex-row items-center gap-1 ">
												<Star className="size-3 fill-current" size={16} />
												{season.vote_average * 10} %
											</span>
										</Badge>
									)}
									<span className="text-sm">
										{season.air_date?.split("-")[0] ?? "TBA"}
									</span>
									{` • `}
									<span className="text-sm">
										{season.episode_count} Episodes
									</span>
								</div>
								<span className="line-clamp-3 text-sm md:text-base">
									{season.overview || "No overview available"}
								</span>
							</div>
						</div>
					</Link>
				))}
			</div>
		</section>
	);
}
