import React from 'react'
import Link from 'next/link'
import Recomendations from './Recomendations'
export default function MediaRecomendations({
  id,
  type,
}: {
  id: number
  type: 'movie' | 'tv'
}) {
  return (
    <div className="pb-5">
      <div className="flex flex-col gap-3">
        <Link
          href={`/movie/${id}/recommendations`}
          className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
        >
          Recommendations
        </Link>
        <Recomendations media_type={type} media_id={id} />
      </div>
    </div>
  )
}
