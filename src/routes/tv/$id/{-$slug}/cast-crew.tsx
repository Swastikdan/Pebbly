import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { MediaCreditSection } from "@/components/media/media-credit-section";
import { VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/hooks/use-canonical-slug-redirect";
import { getBasicTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { detailHead, loadMediaRouteData } from "@/lib/route-helpers";

export const Route = createFileRoute("/tv/$id/{-$slug}/cast-crew")({
  loader: ({ params, context }) =>
    loadMediaRouteData(context, params, { mediaType: "tv" }),
  head: ({ loaderData }) => ({
    meta: detailHead({
      title: loaderData?.title
        ? `${loaderData.title} - Cast & Crew | Pebbly`
        : "Page Not Found | Pebbly",
      description: loaderData?.title
        ? `Explore the cast and crew of ${loaderData.title}.`
        : "Discover the cast and crew of your favorite shows on Pebbly.",
      posterPath: loaderData?.posterPath,
      url:
        loaderData?.id &&
        loaderData?.title &&
        `${VITE_PUBLIC_APP_URL}/tv/${loaderData.id}/${encodeURIComponent(loaderData.title)}/cast-crew`,
    }),
  }),
  component: TvCastAndCrewPage,
});

function TvCastAndCrewPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tmdb.basicTvDetails(Number(id)),
    queryFn: async () => await getBasicTvDetails({ id: parseInt(id, 10) }),
    enabled: !!id,
  });

  useCanonicalSlugRedirect({
    entity: "tv",
    subPageEntity: "cast-crew",
    id: data?.id,
    title: data?.name ?? data?.name,
    incomingPathname: `/tv/${id}/${slug}/cast-crew`,
    isLoading,
  });
  if (isLoading) {
    return <DefaultLoader />;
  }

  if (!data) {
    return <DefaultNotFoundComponent />;
  }
  return (
    <MediaCreditSection
      id={parseInt(id, 10)}
      slug={slug as string}
      title={title}
      type="tv"
    />
  );
}
