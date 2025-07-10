"use client";

import React, { useState } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "./theme-provider";
import NextTopLoader from "nextjs-toploader";
export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(queryClient);
  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <NextTopLoader
          color="#737373"
          height={5}
          showSpinner={false}
          zIndex={1600}
        />
        <QueryClientProvider client={client}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeProvider>
    </>
  );
}
