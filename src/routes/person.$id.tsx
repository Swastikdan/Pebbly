import { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { number, object, optional, picklist, string } from "valibot";

import type { MediaType } from "@/domain/media";
import type { PersonDetails } from "@/lib/tmdb-schemas";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { GoBack } from "@/components/go-back";
import { MediaCard } from "@/components/media-card";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { IMAGE_PREFIX } from "@/constants";
import { useUrlPagedQuery } from "@/hooks/use-url-paged-query";
import { getPersonDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { requireRouteId } from "@/lib/route-helpers";

type FilmographyCredit = {
  id: number;
  popularity: number;
  vote_average: number;
  poster_path: string | null;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  media_type: MediaType;
  role?: string;
};

type FilmographySource = Omit<FilmographyCredit, "media_type" | "role">;

type FilmographyType = "all" | MediaType;

const FILMOGRAPHY_PAGE_SIZE = 24;

const personPageSearchSchema = object({
  page: optional(number()),
  query: optional(string()),
  type: optional(picklist(["all", "movie", "tv"])),
});

function toFilmographyCredit(
  credit: FilmographySource,
  mediaType: MediaType,
  role?: string,
): FilmographyCredit {
  return {
    id: credit.id,
    popularity: credit.popularity,
    vote_average: credit.vote_average,
    poster_path: credit.poster_path,
    title: credit.title,
    name: credit.name,
    release_date: credit.release_date,
    first_air_date: credit.first_air_date,
    media_type: mediaType,
    role,
  };
}

export const Route = createFileRoute("/person/$id")({
  validateSearch: personPageSearchSchema,
  loader: async ({ params, context }) => {
    const personId = requireRouteId(params.id);
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.tmdb.personDetails(personId),
      queryFn: () => getPersonDetails({ id: personId }),
    });
    return { id: String(personId) };
  },
  head: () => ({
    meta: [
      { title: "Person Details | Pebbly" },
      {
        name: "description",
        content: "Explore detailed information about cast and crew on Pebbly.",
      },
    ],
  }),
  component: PersonPage,
});

function PersonPage() {
  const [isBiographyExpanded, setIsBiographyExpanded] = useState(false);
  const { id } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/person/$id" });
  const {
    page: pageNumber,
    query: urlFilmographyQuery,
    type: urlFilmographyType,
  } = useSearch({ from: "/person/$id" });
  const [filmographyQuery, setFilmographyQuery] = useState(
    urlFilmographyQuery ?? "",
  );
  const filmographySearchId = useId();
  const filmographyType: FilmographyType = urlFilmographyType ?? "all";
  const personId = Number(id);

  useEffect(() => {
    setIsBiographyExpanded(false);
    if (document.activeElement?.id !== filmographySearchId) {
      setFilmographyQuery(urlFilmographyQuery ?? "");
    }
  }, [filmographySearchId, urlFilmographyQuery]);

  const { data, error, isLoading } = useQuery<PersonDetails>({
    queryKey: queryKeys.tmdb.personDetails(personId),
    queryFn: async () => await getPersonDetails({ id: personId }),
  });

  const filmographyCredits = useMemo(() => {
    const credits = [
      ...(data?.movie_credits?.cast ?? []).map((credit) =>
        toFilmographyCredit(credit, "movie", credit.character),
      ),
      ...(data?.movie_credits?.crew ?? []).map((credit) =>
        toFilmographyCredit(credit, "movie", credit.job),
      ),
      ...(data?.tv_credits?.cast ?? []).map((credit) =>
        toFilmographyCredit(credit, "tv", credit.character),
      ),
      ...(data?.tv_credits?.crew ?? []).map((credit) =>
        toFilmographyCredit(credit, "tv", credit.job),
      ),
    ];
    const creditsMap = new Map<string, FilmographyCredit>();

    for (const credit of credits) {
      const key = `${credit.media_type}-${credit.id}`;
      if (!creditsMap.has(key)) {
        creditsMap.set(key, credit);
      }
    }

    return [...creditsMap.values()].sort((a, b) => {
      const popularityDifference = b.popularity - a.popularity;
      if (popularityDifference !== 0) return popularityDifference;
      return (a.title ?? a.name ?? "").localeCompare(b.title ?? b.name ?? "");
    });
  }, [
    data?.movie_credits?.cast,
    data?.movie_credits?.crew,
    data?.tv_credits?.cast,
    data?.tv_credits?.crew,
  ]);

  const filteredFilmography = useMemo(() => {
    const normalizedQuery = filmographyQuery.trim().toLocaleLowerCase();

    return filmographyCredits.filter((credit) => {
      if (filmographyType !== "all" && credit.media_type !== filmographyType) {
        return false;
      }
      if (!normalizedQuery) return true;
      const title = (credit.title ?? credit.name ?? "").toLocaleLowerCase();
      return title.includes(normalizedQuery);
    });
  }, [filmographyCredits, filmographyQuery, filmographyType]);

  const totalFilmographyPages = Math.max(
    1,
    Math.ceil(filteredFilmography.length / FILMOGRAPHY_PAGE_SIZE),
  );
  const { page, totalPages, handlePageChange } = useUrlPagedQuery({
    urlPage: pageNumber,
    totalPages: totalFilmographyPages,
    clampGuard: true,
    goToPage: (newPage) => {
      navigate({
        to: "/person/$id",
        params: { id },
        search: {
          page: newPage,
          query: filmographyQuery.trim() || undefined,
          type: filmographyType === "all" ? undefined : filmographyType,
        },
      });
    },
  });
  const currentFilmographyPage = Math.min(
    Math.max(page, 1),
    totalFilmographyPages,
  );
  const pagedFilmography = filteredFilmography.slice(
    (currentFilmographyPage - 1) * FILMOGRAPHY_PAGE_SIZE,
    currentFilmographyPage * FILMOGRAPHY_PAGE_SIZE,
  );

  const handleFilmographySearchChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    setFilmographyQuery(value);
    navigate({
      to: "/person/$id",
      params: { id },
      search: {
        query: value.trim() || undefined,
        type: filmographyType === "all" ? undefined : filmographyType,
      },
      replace: true,
    });
  };

  const handleFilmographyTypeChange = (nextType: FilmographyType) => {
    if (nextType === filmographyType) return;
    navigate({
      to: "/person/$id",
      params: { id },
      search: {
        query: filmographyQuery.trim() || undefined,
        type: nextType === "all" ? undefined : nextType,
      },
    });
  };

  const biography = data?.biography ?? "";
  const biographyParagraphs = useMemo(
    () => biography.split("\n\n").filter(Boolean),
    [biography],
  );
  const biographyId = useId();

  if (isLoading) {
    return <DefaultLoader />;
  }

  if (!data || error) {
    return <DefaultNotFoundComponent />;
  }

  const { name, profile_path, place_of_birth, birthday, deathday } = data;
  const externalIds = data.external_ids ?? {};

  const imageUrl = profile_path
    ? `${IMAGE_PREFIX.HD_PROFILE}${profile_path}`
    : null;

  return (
    <section className="mx-auto block max-w-7xl items-center px-4 py-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <GoBack title="Back" />
        <ShareButton title={name} />
      </div>
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="flex flex-col items-center gap-4 md:sticky md:top-20 md:w-1/3 md:items-start">
          <div className="ring-border/40 relative aspect-2/3 w-64 max-w-sm overflow-hidden rounded-xl ring-1 md:w-full dark:ring-white/6">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={name}
                className="h-full w-full object-cover"
                width={300}
                height={450}
                priority
              />
            ) : (
              <div className="bg-secondary text-muted-foreground flex h-full w-full items-center justify-center text-sm">
                No image available
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2">
            <h1 className="text-h1 text-balance">{name}</h1>
            {birthday && (
              <div className="text-muted-foreground text-sm">
                <span className="text-foreground font-semibold">Born: </span>
                {new Date(birthday).toLocaleDateString()}
                {place_of_birth && ` in ${place_of_birth}`}
              </div>
            )}
            {deathday && (
              <div className="text-muted-foreground text-sm">
                <span className="text-foreground font-semibold">Died: </span>
                {new Date(deathday).toLocaleDateString()}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              {externalIds.imdb_id && (
                <a
                  href={`https://www.imdb.com/name/${externalIds.imdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  IMDb
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:w-2/3">
          {biographyParagraphs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-h2">Biography</h2>
              <div
                id={biographyId}
                className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap"
              >
                <div className="flex flex-col">
                  {isBiographyExpanded ? (
                    biographyParagraphs.map((paragraph, index) => (
                      <p
                        // biome-ignore lint/suspicious/noArrayIndexKey: static paragraph list
                        key={index}
                        className="mb-4"
                      >
                        {paragraph}
                      </p>
                    ))
                  ) : (
                    <p className="mb-2">
                      {biography.length > 300
                        ? `${biography.substring(0, 300)}…`
                        : biography}
                    </p>
                  )}
                  {biography.length > 300 && (
                    <Button
                      className="text-foreground w-fit px-0 font-semibold hover:no-underline"
                      size="sm"
                      variant="link"
                      aria-expanded={isBiographyExpanded}
                      aria-controls={biographyId}
                      onClick={() => setIsBiographyExpanded((prev) => !prev)}
                    >
                      {isBiographyExpanded ? "Read Less" : "Read More"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {filmographyCredits.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-h2">Filmography</h2>
                  <p className="text-muted-foreground text-sm">
                    {filteredFilmography.length} credits
                  </p>
                </div>
                <div
                  className="bg-secondary/50 border-border/40 dark:bg-secondary/30 dark:border-border/20 flex h-8 min-h-8 items-center gap-0.5 rounded-lg border p-0.5"
                  role="tablist"
                  aria-label="Filmography media type"
                >
                  {(
                    [
                      ["all", "All"],
                      ["movie", "Movies"],
                      ["tv", "Series"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      className="h-7 rounded-md px-3 text-xs font-semibold"
                      variant="ghost"
                      onClick={() => handleFilmographyTypeChange(value)}
                      data-active={filmographyType === value}
                      aria-pressed={filmographyType === value}
                      style={
                        filmographyType === value
                          ? {
                              background: "var(--foreground)",
                              color: "var(--background)",
                            }
                          : undefined
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="max-w-sm">
                <label htmlFor={filmographySearchId} className="sr-only">
                  Search filmography
                </label>
                <Input
                  id={filmographySearchId}
                  type="search"
                  value={filmographyQuery}
                  onChange={handleFilmographySearchChange}
                  placeholder="Search filmography…"
                  autoComplete="off"
                />
              </div>

              {pagedFilmography.length > 0 ? (
                <div className="grid w-full grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                  {pagedFilmography.map((credit) => (
                    <div
                      key={`${credit.media_type}-${credit.id}`}
                      className="min-h-25"
                    >
                      <MediaCard
                        id={credit.id}
                        title={credit.title || credit.name || "Untitled"}
                        rating={credit.vote_average || 0}
                        poster_path={credit.poster_path || ""}
                        image={credit.poster_path || ""}
                        media_type={credit.media_type}
                        release_date={
                          credit.release_date || credit.first_air_date || null
                        }
                        card_type="horizontal"
                        className="w-full"
                      />
                      {credit.role && (
                        <p className="text-muted-foreground mt-1 truncate text-xs">
                          {credit.role}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                  No filmography credits match your search.
                </div>
              )}

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentFilmographyPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              )}
            </div>
          )}

          {biographyParagraphs.length === 0 &&
            filmographyCredits.length === 0 && (
              <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                No additional details are available for this person yet.
              </div>
            )}
        </div>
      </div>
    </section>
  );
}
