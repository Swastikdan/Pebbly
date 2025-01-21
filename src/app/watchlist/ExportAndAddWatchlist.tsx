'use client'
import React, { useRef } from 'react'
import { useWatchList } from '@/store/watchlist'
import { WatchList } from '@/types/watchlist'

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
    <div className="flex gap-4">
      <button
        onClick={exportWatchlist}
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      >
        Export Watchlist
      </button>
      <input
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
      </button>
    </div>
  )
}
