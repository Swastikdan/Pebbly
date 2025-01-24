import type { Metadata } from 'next'
import React, { cache } from 'react'
import GoBack from '@/components/GoBack'
import Image from '@/components/Image'
import { notFound } from 'next/navigation'
import { QueryClient } from '@tanstack/react-query'
import { getCredits } from '@/lib/getCredits'
import { MediaCredits, CrewEntity } from '@/types/MediaCredits'
import { IMAGE_PREFIX } from '@/constants'
import ShareButton from '@/components/ShareButton'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}): Promise<Metadata> {
  const title = decodeURIComponent((await params).slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
  return {
    title: `${title} - Cast & Crew`,
    description: `Explore the cast and crew of ${title}`,
  }
}

const queryClient = new QueryClient()

export default async function CastCrewPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const { id, slug } = await params

  const title = decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())

  if (!id) return notFound()

  const credits: MediaCredits = await cache(async () =>
    queryClient.fetchQuery({
      queryKey: ['media-credits', id, 'tv'],
      queryFn: async () => getCredits({ id: parseInt(id), type: 'tv' }),
      staleTime: 1000 * 60 * 60 * 24,
    }),
  )()

  const cast = credits?.cast || []
  const crew = credits?.crew || []
  const castByDepartment = crew.reduce<Map<string, CrewEntity[]>>(
    (acc, item) => {
      const dept = acc.get(item.department) || []
      dept.push(item)
      acc.set(item.department, dept)
      return acc
    },
    new Map(),
  )

  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <GoBack link={`/tv/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>

      <div className="my-5 mb-40 grid justify-between gap-3 space-y-10 md:grid-cols-2 md:space-y-0">
        <div>
          <span className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">Cast</span>(
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
                  fallbackImage="https://ik.imagekit.io/swastikdan/Film-Fanatic/placeholder-user-mono.svg"
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
            <span className="text-2xl font-bold text-primary">Crew</span>(
            {crew?.length})
          </span>

          <div className="pt-5">
            {Array.from(castByDepartment).map(([department, crewMembers]) => (
              <React.Fragment key={`dept-${department}`}>
                <h2 className="mt-3 text-lg font-bold">{department}</h2>
                <div className="grid grid-cols-1 gap-3 pt-5 lg:grid-cols-2">
                  {crewMembers.map((crewMember: CrewEntity) => (
                    <div key={crewMember.id} className="flex items-center pb-0">
                      <Image
                        width={200}
                        height={300}
                        loading="eager"
                        src={IMAGE_PREFIX.SD_PROFILE + crewMember.profile_path}
                        fallbackImage="https://ik.imagekit.io/swastikdan/Film-Fanatic/placeholder-user-mono.svg"
                        alt={crewMember.name}
                        className="aspect-[12/16] h-24 w-auto rounded-lg object-cover"
                      />
                      <div className="flex flex-col items-start pl-5">
                        <p className="text-start font-bold">
                          {crewMember.name}
                        </p>
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
    </section>
  )
}
