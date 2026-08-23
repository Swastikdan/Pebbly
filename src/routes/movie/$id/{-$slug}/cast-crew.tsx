import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import type { Movie } from "@/lib/tmdb-schemas";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { MediaCreditSection } from "@/components/media/media-credit-section";
import { IMAGE_PREFIX, VITE_PUBLIC_APP_URL } from "@/constants";
import { useCanonicalSlugRedirect } from "@/lib/canonical-slug-redirect";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import { getBasicMovieDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { formatMediaTitle, parseAndValidateId } from "@/lib/utils";

export const Route = createFileRoute("/movie/$id/{-$slug}/cast-crew")({
  loader: ({ params, context }) => {
    const { id, slug } = params;
    const parsed = parseAndValidateId(id);
    if (!parsed.success) {
      throw notFound();
    }
    context.queryClient.prefetchQuery({
      queryKey: queryKeys.tmdb.basicMovieDetails(Number(id)),
      queryFn: () => getBasicMovieDetails({ id: parsed.data }),
    });
    const data = context.queryClient.getQueryData<Movie>(
      queryKeys.tmdb.basicMovieDetails(Number(id)),
    );
    const title = formatMediaTitle.decode(slug ?? "");
    return { id, slug, title, posterPath: data?.poster_path ?? null };
  },
  head: ({ loaderData }) => ({
    meta: [
      ...MetaImageTagsGenerator({
        title: loaderData?.title
          ? `${loaderData.title} - Cast & Crew | Pebbly`
          : "Page Not Found | Pebbly",
        description: loaderData?.title
          ? `Explore the cast and crew of ${loaderData.title}.`
          : "Discover the cast and crew of your favorite movies on Pebbly.",
        ogImage: loaderData?.posterPath
          ? `${IMAGE_PREFIX.SD_POSTER}${loaderData.posterPath}`
          : undefined,
        url:
          loaderData?.id &&
          loaderData?.title &&
          `${VITE_PUBLIC_APP_URL}/movie/${loaderData.id}/${encodeURIComponent(loaderData.title)}/cast-crew`,
      }),
    ],
  }),
  component: MovieCastAndCrewPage,
});

function MovieCastAndCrewPage() {
  const { id, slug, title } = Route.useLoaderData();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tmdb.basicMovieDetails(Number(id)),
    queryFn: async () => await getBasicMovieDetails({ id: parseInt(id, 10) }),
    enabled: !!id,
  });

  useCanonicalSlugRedirect({
    entity: "movie",
    subPageEntity: "cast-crew",
    id: data?.id,
    title: data?.title ?? data?.original_title,
    incomingPathname: `/movie/${id}/${slug}/cast-crew`,
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
      type="movie"
    />
  );
}
