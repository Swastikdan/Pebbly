import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { MediaVideoImageContainer } from "@/components/media/media-video-image-container";
import { ShareButton } from "@/components/share-button";
import { VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/hooks/use-canonical-slug-redirect";
import { getBasicTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { detailHead, loadMediaRouteData } from "@/lib/route-helpers";

export const Route = createFileRoute("/tv/$id/{-$slug}/media")({
  loader: ({ params, context }) =>
    loadMediaRouteData(context, params, { mediaType: "tv" }),
  head: ({ loaderData }) => ({
    meta: detailHead({
      title: loaderData?.title
        ? `${loaderData.title} - Media | Pebbly`
        : "Page Not Found | Pebbly",
      description: loaderData?.title
        ? `Watch the latest videos and images of ${loaderData.title}.`
        : "Explore the latest videos and images on Pebbly.",
      posterPath: loaderData?.posterPath,
      url:
        loaderData?.id &&
        loaderData?.title &&
        `${VITE_PUBLIC_APP_URL}/tv/${loaderData.id}/${encodeURIComponent(loaderData.title)}/media`,
    }),
  }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      video: search.video as string | undefined,
      backdrop: search.backdrop as string | undefined,
      poster: search.poster as string | undefined,
    };
  },
  component: TvMediaPage,
});

function TvMediaPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tmdb.basicTvDetails(Number(id)),
    queryFn: async () => await getBasicTvDetails({ id: parseInt(id, 10) }),
    enabled: !!id,
  });

  useCanonicalSlugRedirect({
    entity: "tv",
    subPageEntity: "media",
    id: data?.id,
    title: data?.name ?? data?.original_name,
    incomingPathname: `/tv/${id}/${slug}/media`,
    isLoading,
  });
  if (isLoading) {
    return <DefaultLoader />;
  }

  if (!data) {
    return <DefaultNotFoundComponent />;
  }
  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between gap-3">
          <GoBack link={`/tv/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>
      <MediaVideoImageContainer id={parseInt(id, 10)} media_type="tv" />
    </section>
  );
}
