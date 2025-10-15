import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { GoBack } from "@/components/go-back";
import { MediaVideos } from "@/components/media/media-videos";
import { MediaImages } from "@/components/media/media-images";
import { ShareButton } from "@/components/share-button";
import { DefaultLoader } from "@/components/default-loader";

import { isValidId, formatMediaTitle } from "@/lib/utils";
import { getBasicMovieDetails } from "@/lib/queries";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";

import { env } from "@/env";

export const Route = createFileRoute("/movie/$id/{-$slug}/media")({
  loader: async ({ params }) => {
    const { id, slug } = params;
    if (!isValidId(Number(id))) {
      throw notFound();
    }
    const title = formatMediaTitle.decode(slug ?? "");
    return { id, slug, title };
  },
  head: ({ loaderData }) => ({
    meta: [
      ...MetaImageTagsGenerator({
        title: `${loaderData?.title} - Media | Film Fanatic`,
        description: `Watch the latest videos and images of ${loaderData?.title}`,
        url: `${env.VITE_PUBLIC_APP_URL}/movie/${loaderData?.id}/${encodeURIComponent(loaderData?.title ?? "")}/media`,
      }),
    ],
  }),
  component: MovieMediaPage,
});

function MovieMediaPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery({
    queryKey: ["basic_movie-details", id],
    queryFn: async () => await getBasicMovieDetails({ id: Number(id) }),
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
    throw notFound();
  }

  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <GoBack link={`/movie/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>

      <div className="flex flex-col gap-5 py-3">
        <span className="w-fit text-xl font-semibold md:text-2xl">Videos</span>
        <MediaVideos id={parseInt(id)} media_type="movie" />
      </div>
      <div className="flex flex-col gap-5 py-3 pb-32">
        <span className="w-fit text-xl font-semibold md:text-2xl">Images</span>
        <MediaImages id={parseInt(id)} media_type="movie" />
      </div>
    </section>
  );
}
