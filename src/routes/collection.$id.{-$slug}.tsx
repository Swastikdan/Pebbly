import { createFileRoute, notFound } from "@tanstack/react-router";
import { MovieCollections } from "@/components/movie-collentions";

import { formatMediaTitle, isValidId } from "@/lib/utils";

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
				title: `${loaderData?.title} | Film Fanatic`,
			},
			{
				name: "description",
				content: `Browse ${loaderData?.title} on Film Fanatic.`,
			},
		],
	}),
	component: MovieCollnetionPage,
});

function MovieCollnetionPage() {
	const loaderdata = Route.useLoaderData();
	return <MovieCollections id={loaderdata.id} slug={loaderdata.slug} />;
}
