'use client'
import React from 'react'
import ReactQueryProvider from '@/hooks/QueryProviders'
export function Providers({ children }: { children: React.ReactNode }) {
  return <ReactQueryProvider>{children}</ReactQueryProvider>
}
