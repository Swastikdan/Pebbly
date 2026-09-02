import { useQuery } from "@tanstack/react-query";
import { Link, notFound } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import type { CrewMember } from "@/lib/tmdb-schemas";
import { DefaultLoader } from "@/components/default-loader";
import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";
import { getCredits } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

export const MediaCreditSection = (props: {
  id: number;
  type: MediaType;
  slug: string;
  title: string;
}) => {
  const { id, slug, title, type } = props;
  const { data, isFetching, error } = useQuery({
    queryKey: queryKeys.tmdb.credits(id, type),
    queryFn: async () => getCredits({ id, type }),
  });

  if (isFetching) {
    return <DefaultLoader />;
  }
  if (!data || error) {
    throw notFound();
  }

  const cast = data?.cast ?? [];
  const crew = data?.crew ?? [];
  const hasNoCredits = cast.length === 0 && crew.length === 0;
  const castByDepartment = crew.reduce<Map<string, CrewMember[]>>(
    (acc, item) => {
      const dept = acc.get(item.department) ?? [];

      dept.push(item);
      acc.set(item.department, dept);

      return acc;
    },
    new Map(),
  );

  return (
    <section className="mx-auto block max-w-7xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between gap-3">
          <GoBack link={`/${type}/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>
      <div className="my-5 mb-40 grid justify-between gap-3 space-y-10 md:grid-cols-2 md:space-y-0">
        {hasNoCredits ? (
          <div className="text-muted-foreground col-span-full rounded-lg border border-dashed p-6 text-center text-sm">
            No cast or crew data is available for this title yet.
          </div>
        ) : (
          <>
            <div>
              <span className="flex items-center gap-2">
                <span className="text-foreground font-heading text-2xl font-bold">
                  Cast
                </span>
                ({cast.length})
              </span>
              {cast.length === 0 ? (
                <p className="text-muted-foreground pt-5 text-sm">
                  No cast data available.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 pt-5 lg:grid-cols-2">
                  {cast.map((castMember) => (
                    <Link
                      key={castMember.id}
                      to="/person/$id"
                      params={{ id: String(castMember.id) }}
                      className="group flex items-center pb-0"
                    >
                      {castMember.profile_path ? (
                        <Image
                          alt={castMember.name}
                          className="bg-foreground/10 aspect-12/16 h-24 w-auto rounded-lg object-cover transition-transform duration-300 [@media(hover:hover)]:group-hover:scale-105"
                          height={300}
                          loading="eager"
                          src={
                            IMAGE_PREFIX.SD_PROFILE + castMember.profile_path
                          }
                          width={200}
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground flex aspect-12/16 h-24 w-auto min-w-18 items-center justify-center rounded-lg px-2 text-center text-xs">
                          No image
                        </div>
                      )}
                      <div className="flex flex-col items-start pl-5">
                        <p className="group-hover:text-primary text-start font-bold transition-colors">
                          {castMember.name}
                        </p>
                        <p className="text-start text-sm">
                          {castMember.character || "Role not available"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="flex items-center gap-2">
                <span className="text-foreground font-heading text-2xl font-bold">
                  Crew
                </span>
                ({crew.length})
              </span>

              {crew.length === 0 ? (
                <p className="text-muted-foreground pt-5 text-sm">
                  No crew data available.
                </p>
              ) : (
                <div className="pt-5">
                  {Array.from(castByDepartment).map(
                    ([department, crewMembers]) => (
                      <div key={`dept-${department}`}>
                        <h2 className="mt-3 text-lg font-bold">{department}</h2>
                        <div className="grid grid-cols-1 gap-3 pt-5 lg:grid-cols-2">
                          {crewMembers.map((crewMember: CrewMember) => (
                            <Link
                              key={crewMember.id}
                              to="/person/$id"
                              params={{ id: String(crewMember.id) }}
                              className="group flex items-center pb-0"
                            >
                              {crewMember.profile_path ? (
                                <Image
                                  alt={crewMember.name}
                                  className="bg-foreground/10 aspect-12/16 h-24 w-auto rounded-lg object-cover transition-transform duration-300 [@media(hover:hover)]:group-hover:scale-105"
                                  height={300}
                                  loading="eager"
                                  src={
                                    IMAGE_PREFIX.SD_PROFILE +
                                    crewMember.profile_path
                                  }
                                  width={200}
                                />
                              ) : (
                                <div className="bg-muted text-muted-foreground flex aspect-12/16 h-24 w-auto min-w-18 items-center justify-center rounded-lg px-2 text-center text-xs">
                                  No image
                                </div>
                              )}
                              <div className="flex flex-col items-start pl-5">
                                <p className="group-hover:text-primary text-start font-bold transition-colors">
                                  {crewMember.name}
                                </p>
                                <p className="text-start text-sm">
                                  {crewMember.job || "Job not available"}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
