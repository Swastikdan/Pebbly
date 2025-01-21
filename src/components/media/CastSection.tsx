import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { PersonCard } from '@/components/MediaCard'
import { ScrollContainer } from '@/components/ScrollContainer'

export default function CastSection({
  id,
  urltitle,
  cast,
  crew,
  is_more_cast_crew,
  type,
}: {
  id: number
  urltitle: string
  cast: Array<{
    id: number
    name: string
    character: string
    profile_path: string
  }>
  crew: Array<{
    id: number
    name: string
    job: string
    profile_path: string
  }>
  is_more_cast_crew: boolean
  type: 'movie' | 'tv'
}) {
  return (
    <div className="pb-5">
      <div className="flex flex-col gap-3">
        <Link
          href={`/${type}/${id}/${urltitle}/cast-crew`}
          className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
        >
          Cast / Crew
        </Link>
        {cast.length > 0 && crew.length > 0 ? (
          <div className="flex flex-col gap-3">
            <ScrollContainer>
              <div className="flex items-center gap-3">
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
                {/* {((credits?.cast?.length ?? 0) > 10 ||
                  (credits?.crew?.length ?? 0) > 10) && (
                  <Link href={`/${id}/${urltitle}/cast-crew`}>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="ml-5 mr-10 flex items-center justify-center"
                    >
                      View More
                      <ArrowRight size={24} />
                    </Button>
                  </Link>
                )} */}
                {is_more_cast_crew && (
                  <Link href={`/${type}/${id}/${urltitle}/cast-crew`}>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="ml-5 mr-10 flex items-center justify-center"
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
            >
              Full Cast & Crew
            </Link>
          </div>
        ) : (
          <p className="py-2 text-sm">
            {`We don't have any cast added to this .`}
          </p>
        )}
      </div>
    </div>
  )
}
