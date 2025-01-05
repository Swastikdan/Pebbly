'use client';
import React from 'react';
//import { ThemeProvider } from '@/components/theme-provider';
import ReactQueryProvider from '@/lib/QueryProviders';
export function Providers({ children }: { children: React.ReactNode }) {
  return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
