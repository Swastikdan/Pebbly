import { Loader2 } from 'lucide-react'
import React from 'react'

export default function DefaultLoader() {
  return (
    <div
      className="flex h-[90vh] w-full items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 size={32} className="animate-spin" aria-label="Loading" />
    </div>
  )
}
