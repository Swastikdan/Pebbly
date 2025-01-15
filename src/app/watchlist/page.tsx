import type { Metadata } from 'next'
import { Suspense } from 'react'
import WatchListContatiner from './watchlist-contatiner'
import { MediaCardSkeleton } from '@/components/MediaCard'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Watchlist | Film Fanatic',
  description: 'Your saved movies and TV shows',
}

export default function WatchlistPage() {
  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="top-0 w-full max-w-screen-xl items-center justify-center p-5">
        <h1 className="text-start text-4xl font-bold">Watchlist</h1>
        <p className="mt-2 text-start text-lg">
          Your saved movies and TV shows
        </p>
        <Suspense fallback={<WatchListContainerFallback />}>
          <WatchListContatiner />
        </Suspense>
      </div>
    </section>
  )
}

function WatchListContainerFallback() {
  return (
    <div className="flex min-h-96 w-full items-center justify-center">
      <Loader2 size={32} className="animate-spin" />
    </div>
  )
}
