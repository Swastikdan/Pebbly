import React from "react";
import Link from "next/link";
import { Button } from "@heroui/button";

import { PersonCard } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";
import { ArrowRightLine } from "@/components/icons";

export const CastSection = ({
  id,
  urltitle,
  cast,
  crew,
  is_more_cast_crew,
  type,
}: {
  id: number;
  urltitle: string;
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profile_path?: string;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job: string;
    profile_path?: string;
  }>;
  is_more_cast_crew: boolean;
  type: "movie" | "tv";
}) => {
  {
    return (
      <div className="pb-5">
        <div className="flex flex-col gap-3">
          {cast.length > 0 && crew.length > 0 ? (
            <>
              <Link
                aria-label="View full cast and crew"
                className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
                href={`/${type}/${id}/${encodeURIComponent(urltitle)}/cast-crew`}
              >
                Cast / Crew
              </Link>
              <div className="flex flex-col gap-3">
                <ScrollContainer>
                  <div className="flex items-center gap-2" role="list">
                    {cast.map((cast, index) => (
                      <PersonCard
                        key={index}
                        id={cast.id}
                        known_for_department={cast.character}
                        name={cast.name}
                        profile_path={cast.profile_path ?? ""}
                      />
                    ))}
                    {crew.map((crew, index) => (
                      <PersonCard
                        key={index}
                        id={crew.id}
                        known_for_department={crew.job}
                        name={crew.name}
                        profile_path={crew.profile_path ?? ""}
                      />
                    ))}
                    {is_more_cast_crew && (
                      <Button
                        as={Link}
                        className="mr-10 ml-5 flex items-center justify-center"
                        href={`/${type}/${id}/${urltitle}/cast-crew`}
                        size="lg"
                        variant="flat"
                      >
                        View More
                        <ArrowRightLine size={24} />
                      </Button>
                    )}
                  </div>
                </ScrollContainer>
                <Link
                  aria-label="View full cast and crew"
                  className="w-fit text-lg hover:opacity-70"
                  href={`/${type}/${id}/${urltitle}/cast-crew`}
                >
                  Full Cast & Crew
                </Link>
              </div>
            </>
          ) : (
            <>
              <div
                aria-label="View full cast and crew"
                className="w-fit text-xl font-semibold md:text-2xl"
              >
                Cast / Crew
              </div>
              <p className="py-2 text-sm" role="alert">
                {`We don't have any cast added to this.`}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }
};
