import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { MediaGalleryPage } from "@/components/media/basic-media-pages";
import {
  basicDetailsQuery,
  mediaRouteOptions,
} from "@/lib/media-route-options";

export const Route = createFileRoute("/tv/$id/{-$slug}/media")(
  mediaRouteOptions("tv", TvMediaPage),
);

function TvMediaPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery(basicDetailsQuery("tv", id));

  return (
    <MediaGalleryPage
      entity="tv"
      id={id}
      slug={slug}
      title={title}
      data={data}
      isLoading={isLoading}
    />
  );
}
