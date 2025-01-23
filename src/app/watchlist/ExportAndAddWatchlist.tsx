'use client'
import React, { useRef } from 'react'
import { useWatchList } from '@/store/watchlist'
import { WatchList } from '@/types/watchlist'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { Label } from '@/components/ui/label'
export default function ExportAndAddWatchlist() {
  const { watchlist, update } = useWatchList()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportWatchlist = () => {
    const json = JSON.stringify(watchlist, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'watchlist.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const importWatchlist = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importedData = JSON.parse(content)

        // Extract watchlist array from state structure
        const watchlistArray = importedData.state?.watchlist || importedData

        watchlistArray.forEach((item: WatchList) => {
          update(item)
        })
      } catch (error) {
        console.error('Error importing watchlist:', error)
        alert('Invalid watchlist file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex justify-end pt-5">
      <div className="flex gap-4">
        {/* <button
        onClick={exportWatchlist}
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      >
        Export Watchlist
      </button> */}
        <Button variant="secondary" onClick={exportWatchlist}>
          <Upload />
          Export
        </Button>
        <Label
          htmlFor="watchlist"
          role="button"
          tabIndex={0}
          aria-label="Import watchlist"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={importWatchlist}
            accept=".json"
            className="hidden"
            id="watchlist"
          />
          <Upload />
          Import
        </Label>
        {/* <input
        type="file"
        ref={fileInputRef}
        onChange={importWatchlist}
        accept=".json"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
      >
        Import Watchlist
      </button> */}
      </div>
    </div>
  )
}
