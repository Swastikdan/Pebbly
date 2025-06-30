"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getCredits } from "@/lib/queries";
import type { CrewMember } from "@/types";
import { IMAGE_PREFIX } from "@/constants";
import Image from "@/components/ui/image";
import { Spinner } from "@/components/ui/spinner";
import { notFound } from "next/navigation";
export default function MediaCreditSeaction({
  id,
  type,
}: {
  id: number;
  type: "movie" | "tv";
}) {
  const { data, isFetching, error } = useQuery({
    queryKey: ["media-credits", id, type],
    queryFn: async () => getCredits({ id, type }),
    staleTime: 1000 * 60 * 60,
  });
  if (isFetching) {
    return <Spinner />;
  }
  if (!data || error) {
    return notFound();
  }

  const cast = data?.cast ?? [];
  const crew = data?.crew ?? [];
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
    <div className="my-5 mb-40 grid justify-between gap-3 space-y-10 md:grid-cols-2 md:space-y-0">
      <div>
        <span className="flex items-center gap-2">
          <span className="text-primary text-2xl font-bold">Cast</span>(
          {cast?.length})
        </span>
        <div className="grid grid-cols-1 gap-3 pt-5 lg:grid-cols-2">
          {cast?.map((castMember) => (
            <div key={castMember.id} className="flex items-center pb-0">
              <Image
                width={200}
                height={300}
                loading="eager"
                src={IMAGE_PREFIX.SD_PROFILE + castMember.profile_path}
                // fallbackImage="https://ik.imagekit.io/swastikdan/Film-Fanatic/placeholder-user-mono.svg"
                alt={castMember.name}
                className="aspect-[12/16] h-24 w-auto rounded-lg object-cover"
              />
              <div className="flex flex-col items-start pl-5">
                <p className="text-start font-bold">{castMember.name}</p>
                <p className="text-start text-sm">{castMember.character}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="flex items-center gap-2">
          <span className="text-primary text-2xl font-bold">Crew</span>(
          {crew?.length})
        </span>

        <div className="pt-5">
          {Array.from(castByDepartment).map(([department, crewMembers]) => (
            <React.Fragment key={`dept-${department}`}>
              <h2 className="mt-3 text-lg font-bold">{department}</h2>
              <div className="grid grid-cols-1 gap-3 pt-5 lg:grid-cols-2">
                {crewMembers.map((crewMember: CrewMember) => (
                  <div key={crewMember.id} className="flex items-center pb-0">
                    <Image
                      width={200}
                      height={300}
                      loading="eager"
                      src={IMAGE_PREFIX.SD_PROFILE + crewMember.profile_path}
                      // fallbackImage="https://ik.imagekit.io/swastikdan/Film-Fanatic/placeholder-user-mono.svg"
                      alt={crewMember.name}
                      className="aspect-[12/16] h-24 w-auto rounded-lg object-cover"
                    />
                    <div className="flex flex-col items-start pl-5">
                      <p className="text-start font-bold">{crewMember.name}</p>
                      <p className="text-start text-sm">{crewMember.job}</p>
                    </div>
                  </div>
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
