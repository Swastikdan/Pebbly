'use client'
import React from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import ReactQueryProvider from '@/hooks/QueryProviders'
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </ReactQueryProvider>
  )
}
