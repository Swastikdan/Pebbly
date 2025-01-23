import React from 'react'
import { Button } from '@/components/ui/button'

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
            <Button
              variant="default"
              className="h-6 rounded-sm px-4 text-xs font-light md:text-sm"
              key={index}
            >
              {keyword.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
