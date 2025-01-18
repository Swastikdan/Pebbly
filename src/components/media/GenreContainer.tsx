import React from 'react'
import { Button } from '@/components/ui/button'
import { ScrollContainer } from '@/components/ScrollContainer'
export default function GenreContainer({
  genres,
}: {
  genres: Array<{ name: string }>
}) {
  return (
    <ScrollContainer>
      <div className="flex gap-2 py-1">
        {genres.map((genre, index) => (
          <Button
            variant="secondary"
            className="text-xs md:text-sm"
            size="sm"
            key={index}
          >
            {genre?.name}
          </Button>
        ))}
      </div>
    </ScrollContainer>
  )
}
