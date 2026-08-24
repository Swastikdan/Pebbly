import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { MediaCreditsPage } from "@/components/media/basic-media-pages";
import {
  basicDetailsQuery,
  castCrewRouteOptions,
} from "@/lib/media-route-options";

export const Route = createFileRoute("/movie/$id/{-$slug}/cast-crew")(
  castCrewRouteOptions("movie", MovieCastAndCrewPage),
);

function MovieCastAndCrewPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery(basicDetailsQuery("movie", id));

  return (
    <MediaCreditsPage
      entity="movie"
      id={id}
      slug={slug}
      title={title}
      data={data}
      isLoading={isLoading}
    />
  );
}
