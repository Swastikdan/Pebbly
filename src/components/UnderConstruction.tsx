import { Construction as ConstructionIcon } from 'lucide-react'

export default function UnderConstruction() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center bg-background p-4 text-center">
      <div className="inline-flex items-center gap-2 sm:gap-4">
        <ConstructionIcon className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16" />
        <span className="text-3xl sm:text-4xl md:text-6xl">
          Under Construction
        </span>
      </div>
      <p className="mt-2 px-4 text-xs text-muted-foreground sm:mt-4 sm:max-w-lg sm:text-sm">
        This page is currently being worked on. Please check back later.
      </p>
    </div>
  )
}
