import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { MediaCard } from "@/components/media-card";
import { ShareButton } from "@/components/share-button";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";
import { getPersonDetails } from "@/lib/queries";
import { isValidId } from "@/lib/utils";
import type { PersonDetails } from "@/types";

type KnownForCredit = {
	id: number;
	popularity: number;
	vote_average: number;
	poster_path: string | null;
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
	media_type: "movie" | "tv";
};

export const Route = createFileRoute("/person/$id")({
	loader: async ({ params }) => {
		const { id } = params;
		if (!isValidId(parseInt(id, 10))) {
			throw notFound();
		}
		return { id };
	},
	head: () => ({
		meta: [
			{ title: "Person Details | Film Fanatic" },
			{
				name: "description",
				content:
					"Explore detailed information about cast and crew on Film Fanatic.",
			},
		],
	}),
	component: PersonPage,
});

function PersonPage() {
	const { id } = Route.useLoaderData();
	const personId = parseInt(id, 10);

	const { data, error, isLoading } = useQuery<PersonDetails>({
		queryKey: ["person_details", personId],
		queryFn: async () => await getPersonDetails({ id: personId }),
	});

	const knownForCredits = useMemo(() => {
		const movieCastCredits =
			data?.movie_credits?.cast?.map((credit) => ({
				id: credit.id,
				popularity: credit.popularity,
				vote_average: credit.vote_average,
				poster_path: credit.poster_path,
				title: credit.title,
				name: credit.name,
				release_date: credit.release_date,
				first_air_date: credit.first_air_date,
				media_type: "movie" as const,
			})) ?? [];

		const movieCrewCredits =
			data?.movie_credits?.crew?.map((credit) => ({
				id: credit.id,
				popularity: credit.popularity,
				vote_average: credit.vote_average,
				poster_path: credit.poster_path,
				title: credit.title,
				name: credit.name,
				release_date: credit.release_date,
				first_air_date: credit.first_air_date,
				media_type: "movie" as const,
			})) ?? [];

		const tvCastCredits =
			data?.tv_credits?.cast?.map((credit) => ({
				id: credit.id,
				popularity: credit.popularity,
				vote_average: credit.vote_average,
				poster_path: credit.poster_path,
				title: credit.title,
				name: credit.name,
				release_date: credit.release_date,
				first_air_date: credit.first_air_date,
				media_type: "tv" as const,
			})) ?? [];

		const tvCrewCredits =
			data?.tv_credits?.crew?.map((credit) => ({
				id: credit.id,
				popularity: credit.popularity,
				vote_average: credit.vote_average,
				poster_path: credit.poster_path,
				title: credit.title,
				name: credit.name,
				release_date: credit.release_date,
				first_air_date: credit.first_air_date,
				media_type: "tv" as const,
			})) ?? [];

		const creditsMap = new Map<string, KnownForCredit>();

		for (const credit of [
			...movieCastCredits,
			...tvCastCredits,
			...movieCrewCredits,
			...tvCrewCredits,
		]) {
			const key = `${credit.media_type}-${credit.id}`;
			if (!creditsMap.has(key)) {
				creditsMap.set(key, credit);
			}
		}

		return [...creditsMap.values()]
			.sort((a, b) => b.popularity - a.popularity)
			.slice(0, 24);
	}, [
		data?.movie_credits?.cast,
		data?.movie_credits?.crew,
		data?.tv_credits?.cast,
		data?.tv_credits?.crew,
	]);

	const biographyParagraphs = useMemo(
		() => data?.biography?.split("\n\n").filter(Boolean) ?? [],
		[data?.biography],
	);

	if (isLoading) {
		return <DefaultLoader />;
	}

	if (!data || error) {
		throw notFound();
	}

	const {
		name,
		profile_path,
		place_of_birth,
		birthday,
		deathday,
	} = data;
	const externalIds = data.external_ids ?? {};

	const imageUrl = profile_path
		? `${IMAGE_PREFIX.HD_PROFILE}${profile_path}`
		: null;

	return (
		<section className="mx-auto block max-w-screen-xl items-center px-4 py-5">
			<div className="mb-5 flex items-center justify-between gap-3">
				<GoBack title="Back" />
				<ShareButton title={name} />
			</div>
			<div className="flex flex-col gap-8 md:flex-row md:items-start">
				<div className="flex flex-col items-center gap-4 md:sticky md:top-20 md:w-1/3 md:items-start">
					<div className="relative aspect-[2/3] w-64 max-w-sm overflow-hidden rounded-xl shadow-lg md:w-full">
						{imageUrl ? (
							<Image
								src={imageUrl}
								alt={name}
								className="h-full w-full object-cover"
								width={300}
								height={450}
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center bg-secondary text-sm text-muted-foreground">
								No image available
							</div>
						)}
					</div>

					<div className="flex w-full flex-col gap-2">
						<h1 className="text-3xl font-bold">{name}</h1>
						{birthday && (
							<div className="text-sm text-muted-foreground">
								<span className="font-semibold text-foreground">Born: </span>
								{new Date(birthday).toLocaleDateString()}
								{place_of_birth && ` in ${place_of_birth}`}
							</div>
						)}
						{deathday && (
							<div className="text-sm text-muted-foreground">
								<span className="font-semibold text-foreground">Died: </span>
								{new Date(deathday).toLocaleDateString()}
							</div>
						)}

						<div className="flex gap-4 pt-2">
							{externalIds.imdb_id && (
								<a
									href={`https://www.imdb.com/name/${externalIds.imdb_id}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm font-medium hover:underline"
								>
									IMDb
								</a>
							)}
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-8 md:w-2/3">
					{biographyParagraphs.length > 0 && (
						<div className="space-y-2">
							<h2 className="text-2xl font-semibold">Biography</h2>
							<div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
								{biographyParagraphs.map((paragraph, index) => (
									<p key={index} className="mb-4">
										{paragraph}
									</p>
								))}
							</div>
						</div>
					)}

					{knownForCredits.length > 0 && (
						<div className="space-y-4">
							<h2 className="text-2xl font-semibold">Known For</h2>
							<div className="grid w-full grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
								{knownForCredits.map((credit) => (
									<div
										key={`${credit.media_type}-${credit.id}`}
										className="min-h-[300px]"
									>
										<MediaCard
											id={credit.id}
											title={credit.title || credit.name || "Untitled"}
											rating={credit.vote_average || 0}
											poster_path={credit.poster_path || ""}
											image={credit.poster_path || ""}
											media_type={credit.media_type}
											release_date={
												credit.release_date || credit.first_air_date || null
											}
											card_type="horizontal"
											className="w-full"
										/>
									</div>
								))}
							</div>
						</div>
					)}

					{biographyParagraphs.length === 0 && knownForCredits.length === 0 && (
						<div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
							No additional details are available for this person yet.
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
