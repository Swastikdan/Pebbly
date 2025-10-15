import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { SeasonContainer } from "@/components/media/season-container";
import { DefaultLoader } from "@/components/default-loader";

import { isValidId, formatMediaTitle } from "@/lib/utils";
import { getBasicTvDetails } from "@/lib/queries";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";

import { env } from "@/env";

export const Route = createFileRoute("/tv/$id/{-$slug}/seasons")({
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
        title: `${loaderData?.title} - Cast & Crew | Film Fanatic`,
        description: `Explore the cast and crew of  ${loaderData?.title}`,
        url: `${env.VITE_PUBLIC_APP_URL}/tv/${loaderData?.id}/${encodeURIComponent(loaderData?.title ?? "")}/seasons`,
      }),
    ],
  }),
  component: TvSeasonsPage,
});

function TvSeasonsPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery({
    queryKey: ["basic_tv-details", id],
    queryFn: async () => await getBasicTvDetails({ id: Number(id) }),
    enabled: !!id,
  });

  useCanonicalSlugRedirect({
    entity: "tv",
    subPageEntity: "seasons",
    id: data?.id,
    title: data?.name ?? data?.name,
    incomingPathname: `/tv/${id}/${slug}/seasons`,
    isLoading,
  });
  if (isLoading) {
    return <DefaultLoader />;
  }

  if (!data) {
    throw notFound();
  }
  return (
    <section className="mx-auto block min-h-[90vh] max-w-screen-xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <GoBack link={`/tv/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>
      <SeasonContainer tv_id={parseInt(id)} />
    </section>
  );
}
