import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { MediaCreditsPage } from "@/components/media/basic-media-pages";
import {
  basicDetailsQuery,
  castCrewRouteOptions,
} from "@/lib/media-route-options";

export const Route = createFileRoute("/tv/$id/{-$slug}/cast-crew")(
  castCrewRouteOptions("tv", TvCastAndCrewPage),
);

function TvCastAndCrewPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery(basicDetailsQuery("tv", id));

  return (
    <MediaCreditsPage
      entity="tv"
      id={id}
      slug={slug}
      title={title}
      data={data}
      isLoading={isLoading}
    />
  );
}
