import { Loader2 } from 'lucide-react'
import React from 'react'

export default function DefaultLoader() {
  return (
    <div className="flex h-[90vh] w-full items-center justify-center">
      <Loader2 size={32} className="animate-spin" />
    </div>
  )
}
