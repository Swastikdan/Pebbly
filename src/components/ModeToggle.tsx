/* The code snippet provided is a TypeScript React component called `ModeToggle`. This component is
responsible for rendering a button that toggles between light and dark themes. Here is a breakdown
of what the code is doing: */
'use client'
import React, { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

export function ModeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) {
    return <Skeleton className="size-11 sm:size-9" aria-label="Toggle theme" />
  }
  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="relative size-11 sm:size-9"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Sun className="size-11 sm:size-9" />
            ) : (
              <Moon className="size-11 sm:size-9" />
            )}

            <span className="sr-only">Toggle theme</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-sm font-medium">Change Theme</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
