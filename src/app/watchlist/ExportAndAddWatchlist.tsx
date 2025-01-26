'use client'
import React, { useState, useRef } from 'react'
import { useWatchList } from '@/store/watchlist'
import { WatchList } from '@/types/watchlist'
import { Button } from '@/components/ui/button'
import { Loader2, Upload, ArrowDownToLine } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { AuthButton } from '@/components/AuthButton'
import { watch } from 'fs'

export default function ExportAndAddWatchlist() {
  const [importLoading, setImportLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const { watchlist, loading, update } = useWatchList()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportWatchlist = async () => {
    try {
      setExportLoading(true)
      const json = JSON.stringify(watchlist, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = self.crypto.randomUUID() + '.json'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting watchlist:', error)
    } finally {
      setExportLoading(false)
    }
  }

  const importWatchlist = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportLoading(true)
    const file = event.target.files?.[0]
    if (!file) {
      setImportLoading(false)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importedData = JSON.parse(content)
        const watchlistArray = importedData.state?.watchlist || importedData
        watchlistArray.forEach((item: WatchList) => {
          update(item)
        })
      } catch (error) {
        console.error('Error importing watchlist:', error)
        alert('Invalid watchlist file')
      } finally {
        setImportLoading(false)
      }
    }
    reader.onerror = () => {
      console.error('Error reading file')
      setImportLoading(false)
    }
    reader.readAsText(file)
  }
  console.log('watchlist', watchlist)
  if (loading) return null
  return (
    <div className="flex justify-end pt-5">
      <div className="flex gap-4">
        {watchlist && watchlist.length > 0 && (
          <>
            <Button
              variant="secondary"
              disabled={exportLoading}
              onClick={exportWatchlist}
            >
              {exportLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <ArrowDownToLine size={20} />
              )}
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
              {...(importLoading && { disabled: true })}
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={importWatchlist}
                accept=".json"
                className="hidden"
                id="watchlist"
                disabled={importLoading}
              />
              {importLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Upload size={20} />
              )}
              Import
            </Label>
          </>
        )}
        <AuthButton />
      </div>
    </div>
  )
}
