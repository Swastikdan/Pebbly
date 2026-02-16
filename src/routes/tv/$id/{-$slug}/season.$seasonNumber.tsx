import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { VideoPlayerModal } from "@/components/video-player-modal";
import { IMAGE_PREFIX, VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getTvDetails, getTvSeasonDetails } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";

export const Route = createFileRoute("/tv/$id/{-$slug}/season/$seasonNumber")({
	loader: async ({ params }) => {
		const { id, slug, seasonNumber } = params;
		if (
			!isValidId(parseInt(id, 10)) ||
			!isValidId(parseInt(seasonNumber, 10))
		) {
			throw notFound();
		}
		const title = formatMediaTitle.decode(slug ?? "");
		return { id, slug, title, seasonNumber: parseInt(seasonNumber, 10) };
	},
	head: ({ loaderData }) => ({
		meta: [
			...MetaImageTagsGenerator({
				title: loaderData?.title
					? `${loaderData.title} - Season ${loaderData.seasonNumber} | Film Fanatic`
					: "Page Not Found | Film Fanatic",
				description: loaderData?.title
					? `All episodes of ${loaderData.title} Season ${loaderData.seasonNumber}.`
					: "Explore all episodes of your favorite shows on Film Fanatic.",
				url:
					loaderData?.id &&
					loaderData.title &&
					`${VITE_PUBLIC_APP_URL}/tv/${loaderData.id}/${loaderData.slug}/season/${loaderData.seasonNumber}`,
			}),
		],
	}),
	component: TvSeasonDetailPage,
});

function TvSeasonDetailPage() {
	const { id, slug, seasonNumber } = Route.useLoaderData();
	const tvId = parseInt(id, 10);

	const { data: tvData, isLoading: tvLoading } = useQuery({
		queryKey: ["tv_details", tvId],
		queryFn: async () => await getTvDetails({ id: tvId }),
		enabled: !!tvId,
	});

	const { data: seasonData, isLoading: seasonLoading } = useQuery({
		queryKey: ["tv_season_details", tvId, seasonNumber],
		queryFn: async () => await getTvSeasonDetails({ tvId, seasonNumber }),
		enabled: !!tvId,
	});

	useCanonicalSlugRedirect({
		entity: "tv",
		subPageEntity: `season/${seasonNumber}`,
		id: tvData?.id,
		title: tvData?.name ?? tvData?.name,
		incomingPathname: `/tv/${id}/${slug}/season/${seasonNumber}`,
		isLoading: tvLoading,
	});

	if (tvLoading || seasonLoading) {
		return <DefaultLoader />;
	}

	if (!tvData || !seasonData) {
		throw notFound();
	}

	const episodes = seasonData.episodes ?? [];
	const seasons = tvData.seasons?.slice() ?? [];
	const showName = tvData.name ?? tvData.original_name;
	const urltitle = formatMediaTitle.encode(showName);

	return (
		<section className="mx-auto block min-h-[90vh] max-w-screen-xl items-center px-4">
			<div className="space-y-3 py-5">
				<div className="flex items-center justify-between">
					<GoBack link={`/tv/${id}/${slug}/seasons`} title="All Seasons" />
					<ShareButton />
				</div>
				<h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
					{showName} — {seasonData.name}
				</h1>
				{seasonData.overview && (
					<p className="max-w-3xl text-sm text-muted-foreground md:text-base">
						{seasonData.overview}
					</p>
				)}
			</div>

			{/* Season Navigation */}
			<div className="scrollbar-hidden mb-6 flex gap-2 overflow-x-auto pb-2">
				{seasons.map((s) => (
					<Link
						key={s.id}
						// @ts-expect-error - correct link
						to={`/tv/${id}/${urltitle}/season/${s.season_number}`}
						className={`pressable-small whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
							s.season_number === seasonNumber
								? "bg-foreground text-background shadow-md"
								: "bg-secondary/50 text-foreground hover:bg-secondary"
						}`}
					>
						{s.name}
					</Link>
				))}
			</div>

			{/* Episodes List */}
			<div className="flex flex-col gap-4 pb-32">
				{episodes.map((episode) => (
					<div
						key={episode.id}
						className="group relative overflow-hidden rounded-2xl border-2 border-default bg-secondary/10 transition-all duration-300 hover:border-foreground/20 hover:bg-secondary/20 hover:shadow-lg"
					>
						<div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-start md:p-4">
							{/* Episode Still Image */}
							<div className="relative shrink-0">
								<Image
									alt={episode.name}
									className="h-36 w-full rounded-xl bg-foreground/10 object-cover sm:h-28 sm:w-48 md:h-32 md:w-56"
									height={180}
									src={
										episode.still_path
											? `${IMAGE_PREFIX.SD_BACKDROP}${episode.still_path}`
											: `https://placehold.co/500x281?text=No+Image`
									}
									width={320}
								/>
								{/* Play overlay on episode still */}
								<VideoPlayerModal
									tmdbId={tvId}
									type="tv"
									title={`${showName} - ${episode.name}`}
									season={seasonNumber}
									episode={episode.episode_number}
									variant="card"
								/>
							</div>

							{/* Episode Info */}
							<div className="flex flex-1 flex-col gap-2">
								<div className="flex items-start justify-between gap-2">
									<div className="flex flex-col gap-1">
										<span className="text-xs font-medium text-muted-foreground uppercase">
											Episode {episode.episode_number}
										</span>
										<h3 className="line-clamp-1 text-lg font-bold md:text-xl">
											{episode.name}
										</h3>
									</div>
									<VideoPlayerModal
										tmdbId={tvId}
										type="tv"
										title={`${showName} - ${episode.name}`}
										season={seasonNumber}
										episode={episode.episode_number}
										variant="episode"
									/>
								</div>

								<div className="flex flex-wrap items-center gap-2">
									{episode.vote_average > 0 && (
										<Badge
											className="rounded-lg px-2 text-xs font-light"
											variant="secondary"
										>
											<span className="flex items-center gap-1">
												<Star
													className="size-3 fill-current text-yellow-400"
													size={12}
												/>
												{episode.vote_average.toFixed(1)}
											</span>
										</Badge>
									)}
									{episode.air_date && (
										<span className="text-xs text-muted-foreground">
											{new Date(episode.air_date).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</span>
									)}
									{episode.runtime && (
										<>
											<span className="text-xs text-muted-foreground">•</span>
											<span className="text-xs text-muted-foreground">
												{episode.runtime} min
											</span>
										</>
									)}
								</div>

								<p className="line-clamp-2 text-sm text-muted-foreground md:line-clamp-3">
									{episode.overview || "No overview available."}
								</p>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
