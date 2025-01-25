import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '../ui/badge'

export default function MediaKeywords({
  keywords,
}: {
  keywords: Array<{ name: string }>
}) {
  if (keywords.length === 0) return null
  return (
    <div className="py-5">
      <div className="flex flex-col gap-5">
        <span className="w-fit text-xl font-semibold md:text-2xl">
          Keywords
        </span>
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <Badge
              variant="default"
              className="h-6 cursor-auto rounded-sm px-4 text-xs font-light hover:bg-primary md:text-sm"
              key={index}
            >
              {keyword.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
