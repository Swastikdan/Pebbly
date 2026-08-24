import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { MediaGalleryPage } from "@/components/media/basic-media-pages";
import {
  basicDetailsQuery,
  mediaRouteOptions,
} from "@/lib/media-route-options";

export const Route = createFileRoute("/movie/$id/{-$slug}/media")(
  mediaRouteOptions("movie", MovieMediaPage),
);

function MovieMediaPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery(basicDetailsQuery("movie", id));

  return (
    <MediaGalleryPage
      entity="movie"
      id={id}
      slug={slug}
      title={title}
      data={data}
      isLoading={isLoading}
    />
  );
}
