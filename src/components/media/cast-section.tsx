import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { PersonCard } from "@/components/media-card";
import { ScrollContainer } from "@/components/scroll-container";

export default function CastSection({
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
    profile_path: string;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job: string;
    profile_path: string;
  }>;
  is_more_cast_crew: boolean;
  type: "movie" | "tv";
}) {
  return (
    <div className="pb-5">
      <div className="flex flex-col gap-3">
        {cast.length > 0 && crew.length > 0 ? (
          <>
            <Link
              href={`/${type}/${id}/${urltitle}/cast-crew`}
              className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
              aria-label="View full cast and crew"
            >
              Cast / Crew
            </Link>
            <div className="flex flex-col gap-3">
              <ScrollContainer>
                <div className="flex items-center gap-3" role="list">
                  {cast.map((cast, index) => (
                    <PersonCard
                      key={index}
                      id={cast.id}
                      name={cast.name}
                      known_for_department={cast.character}
                      profile_path={cast.profile_path}
                    />
                  ))}
                  {crew.map((crew, index) => (
                    <PersonCard
                      key={index}
                      id={crew.id}
                      name={crew.name}
                      known_for_department={crew.job}
                      profile_path={crew.profile_path}
                    />
                  ))}
                  {is_more_cast_crew && (
                    <Link
                      href={`/${type}/${id}/${urltitle}/cast-crew`}
                      aria-label="View more cast and crew"
                    >
                      <Button
                        variant="secondary"
                        size="lg"
                        className="mr-10 ml-5 flex items-center justify-center"
                      >
                        View More
                        <ArrowRight size={24} />
                      </Button>
                    </Link>
                  )}
                </div>
              </ScrollContainer>
              <Link
                href={`/${type}/${id}/${urltitle}/cast-crew`}
                className="w-fit text-lg hover:opacity-70"
                aria-label="View full cast and crew"
              >
                Full Cast & Crew
              </Link>
            </div>
          </>
        ) : (
          <>
            <div
              className="w-fit text-xl font-semibold md:text-2xl"
              aria-label="View full cast and crew"
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
