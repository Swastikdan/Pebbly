import type { MediaType } from "@/lib/media-types";
import type { BasicMovie, BasicTv } from "@/lib/tmdb-schemas";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { MediaCreditSection } from "@/components/media/media-credit-section";
import { MediaVideoImageContainer } from "@/components/media/media-video-image-container";
import { ShareButton } from "@/components/share-button";
import { useCanonicalSlugRedirect } from "@/hooks/use-canonical-slug-redirect";

/**
 * Presentational bodies shared by the movie/tv "media" and "cast-crew" twin
 * routes: canonical slug redirect, loading/not-found guards, and page markup.
 * The route files keep the literal createFileRoute call, the useQuery call,
 * and pass the loader trio + query result down.
 */

type AnyBasicDetails = BasicMovie | BasicTv;
type BasicDetailsOf<K extends MediaType> = K extends "movie"
  ? BasicMovie
  : BasicTv;

function defaultCanonicalTitle(
  isMovie: boolean,
  data?: AnyBasicDetails,
): string | undefined {
  if (!data) return undefined;
  if (isMovie) {
    const movie = data as BasicMovie;
    return movie.title ?? movie.original_title;
  }
  const tv = data as BasicTv;
  return tv.name ?? tv.original_name;
}

export function MediaGalleryPage(props: {
  entity: MediaType;
  id: string;
  slug?: string;
  title: string;
  data?: AnyBasicDetails;
  isLoading: boolean;
}) {
  const { entity, id, slug, title, data, isLoading } = props;
  useCanonicalSlugRedirect({
    entity,
    subPageEntity: "media",
    id: data?.id,
    title: defaultCanonicalTitle(entity === "movie", data),
    incomingPathname: `/${entity}/${id}/${slug}/media`,
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
          <GoBack link={`/${entity}/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>
      <MediaVideoImageContainer id={parseInt(id, 10)} media_type={entity} />
    </section>
  );
}

export function MediaCreditsPage<K extends MediaType>(props: {
  entity: K;
  id: string;
  slug?: string;
  title: string;
  data?: BasicDetailsOf<K>;
  isLoading: boolean;
  /**
   * Overrides the default entity redirect-title lookup. Kept so each twin can
   * preserve its exact original selector expression.
   */
  selectRedirectTitle?: (
    data: BasicDetailsOf<K> | undefined,
  ) => string | undefined;
}) {
  const { entity, id, slug, title, data, isLoading, selectRedirectTitle } =
    props;
  const redirectTitle = selectRedirectTitle
    ? selectRedirectTitle(data)
    : defaultCanonicalTitle(entity === "movie", data);
  useCanonicalSlugRedirect({
    entity,
    subPageEntity: "cast-crew",
    id: data?.id,
    title: redirectTitle,
    incomingPathname: `/${entity}/${id}/${slug}/cast-crew`,
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
      type={entity}
    />
  );
}
