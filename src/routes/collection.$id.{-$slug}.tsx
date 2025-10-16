import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { MediaCard } from "@/components/media-card";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Star } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { getCollection } from "@/lib/queries";
import { formatMediaTitle, isValidId } from "@/lib/utils";
import type { Collection } from "@/types";

export const Route = createFileRoute("/collection/$id/{-$slug}")({
	loader: async ({ params }) => {
		const { id, slug } = params;
		if (!isValidId(parseInt(id, 10))) {
			throw notFound();
		}
		const title = slug ? formatMediaTitle.decode(slug) : "Collections";
		return { id, slug, title };
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.title
					? `${loaderData.title} | Film Fanatic`
					: "Page Not Found | Film Fanatic",
			},
			{
				name: "description",
				content: loaderData?.title
					? `Browse ${loaderData.title} on Film Fanatic.`
					: "Explore movies and shows on Film Fanatic.",
			},
		],
	}),

	component: MovieCollnetionPage,
});

function MovieCollnetionPage() {
	const { id, slug } = Route.useLoaderData();
	const { data, error, isLoading } = useQuery<Collection>({
		queryKey: ["movie_details", id],
		queryFn: async () => await getCollection({ id: parseInt(id, 10) }),
	});

	useCanonicalSlugRedirect({
		entity: "collection",
		subPageEntity: "collection",
		id: data?.id,
		title: data?.name,
		incomingPathname: `/collection/${id}/${slug}`,
		isLoading,
	});

	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data || error) {
		throw notFound();
	}
	const { name, overview, poster_path, parts } = data;

	const user_rating =
		parts && parts.length > 0
			? parseInt(
					(
						(parts.map((part) => part.vote_average).reduce((a, b) => a + b, 0) /
							parts.length) *
						10
					).toFixed(0),
					10,
				)
			: 0;

	const original_language =
		Array.isArray(parts) && parts.length > 0
			? parts[0].original_language
			: "en";

	const part_count = parts ? parts.length : 0;

	return (
		<section className="mx-auto block max-w-screen-xl items-center px-4 py-5">
			<div className="space-y-3 py-10 ">
				<div className="flex items-center justify-between">
					<GoBack />
					<ShareButton />
				</div>
			</div>
			<div className="flex w-full flex-col items-center gap-5 sm:flex-row sm:items-start">
				<div className="flex w-full justify-center sm:w-auto">
					<Image
						alt={name}
						className="h-[280px] w-[200px] shrink-0 rounded-xl object-cover sm:h-52 sm:w-36"
						height={300}
						src={IMAGE_PREFIX.HD_POSTER + poster_path}
						width={200}
					/>
				</div>

				<div className="flex w-full flex-1 flex-col items-center justify-center gap-2 overflow-hidden py-3 sm:items-start">
					<span className="line-clamp-1 text-center text-xl font-bold transition-opacity duration-200 ease-in-out hover:opacity-90 sm:text-left md:text-2xl dark:hover:opacity-70">
						{name}
					</span>
					<div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
						{user_rating > 0 && (
							<Badge
								className=" rounded-md px-1 text-sm font-light"
								variant="secondary"
							>
								<span className="flex flex-row w-full items-center gap-1">
									<Star className="size-3 fill-current" size={16} />
									{user_rating} %
								</span>
							</Badge>
						)}
						<span className="text-sm uppercase">{original_language}</span>
						{` • `}
						<span className="text-sm">{part_count} Movies</span>
					</div>
					<span className="line-clamp-3 text-center text-sm sm:text-left md:text-base">
						{overview || "No overview available"}
					</span>
				</div>
			</div>
			<div className="flex flex-col gap-5 py-10">
				<span className="text-foreground text-2xl font-semibold">
					All Movies
				</span>
				<div className="grid w-full grid-cols-2 items-center justify-center gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
					{parts?.map((part) => (
						<MediaCard
							key={part.id}
							id={part.id}
							image={part.poster_path ?? ""}
							media_type="movie"
							poster_path={part.poster_path ?? ""}
							rating={part.vote_average ?? 0}
							release_date={part.release_date ?? null}
							title={part.title}
							card_type="horizontal"
						/>
					))}
				</div>
			</div>
		</section>
	);
}
