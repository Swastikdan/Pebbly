import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 | Not Found',
  description: 'This page could not be found',
}

export default function NotFoundPage() {
  return (
    <div className="grid h-full min-h-screen place-content-center items-center justify-center">
      <h1 className="font-heading text-xl uppercase tracking-widest">
        404 | Not Found
      </h1>
    </div>
  )
}
