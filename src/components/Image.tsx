'use client'

import { cn } from '@/lib/utils'
import { cache } from 'react'
import { ImageProps as NextImageProps } from 'next/image'
import NextImage from 'next/image'
import { useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { JSX } from 'react' // Import JSX namespace

/**
 * Default placeholder image in base64 format
 * Displays a neutral gray image icon when the main image fails to load
 */
const DEFAULT_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA1MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTM1LjYxNTQgMjBIMTQuMzg0NkMxNC4wMTc0IDIwIDEzLjY2NTIgMjAuMTUwOSAxMy40MDU2IDIwLjQxOTRDMTMuMTQ1OSAyMC42ODc5IDEzIDIxLjA1MjEgMTMgMjEuNDMxOFYzOS41NjgyQzEzIDM5Ljk0NzkgMTMuMTQ1OSA0MC4zMTIxIDEzLjQwNTYgNDAuNTgwNkMxMy42NjUyIDQwLjg0OTEgMTQuMDE3NCA0MSAxNC4zODQ2IDQxSDM1LjYxNTRDMzUuOTgyNiA0MSAzNi4zMzQ4IDQwLjg0OTEgMzYuNTk0NCA0MC41ODA2QzM2Ljg1NDEgNDAuMzEyMSAzNyAzOS45NDc5IDM3IDM5LjU2ODJWMjEuNDMxOEMzNyAyMS4wNTIxIDM2Ljg1NDEgMjAuNjg3OSAzNi41OTQ0IDIwLjQxOTRDMzYuMzM0OCAyMC4xNTA5IDM1Ljk4MjYgMjAgMzUuNjE1NCAyMFpNMzQuMjMwOCAzMi44ODY0TDI5LjgwNTMgMjcuODk0QzI5LjcyMTYgMjcuNzk4MyAyOS42MTk4IDI3LjcyMTIgMjkuNTA2MiAyNy42Njc2QzI5LjM5MjcgMjcuNjEzOSAyOS4yNjk4IDI3LjU4NDggMjkuMTQ1IDI3LjU4MkMyOS4wMjAyIDI3LjU3OTIgMjguODk2MSAyNy42MDI4IDI4Ljc4MDQgMjcuNjUxM0MyOC42NjQ3IDI3LjY5OTggMjguNTU5OCAyNy43NzIyIDI4LjQ3MjEgMjcuODY0MUwyMy41MzYxIDMyLjk2ODRMMjguNTMzNiAzOC4xMzY0SDI1LjkyMzFMMjEuNDk4OSAzMy41NjEyQzIxLjMyNTcgMzMuMzgyMyAyMS4wOTA5IDMzLjI4MTggMjAuODQ2MiAzMy4yODE4QzIwLjYwMTQgMzMuMjgxOCAyMC4zNjY2IDMzLjM4MjMgMjAuMTkzNSAzMy41NjEyTDE1Ljc2OTIgMzguMTM2NFYyMi44NjM2SDM0LjIzMDhWMzIuODg2NFpNMTcuNzA3NyAyNy4xNTkxQzE3LjcwNzcgMjYuNzA2IDE3LjgzNzYgMjYuMjYzMSAxOC4wODExIDI1Ljg4NjNDMTguMzI0NSAyNS41MDk2IDE4LjY3MDUgMjUuMjE2IDE5LjA3NTMgMjUuMDQyNkMxOS40ODAxIDI0Ljg2OTIgMTkuOTI1NSAyNC44MjM4IDIwLjM1NTMgMjQuOTEyMkMyMC43ODUgMjUuMDAwNiAyMS4xNzk4IDI1LjIxODggMjEuNDg5NiAyNS41MzkyQzIxLjc5OTQgMjUuODU5NiAyMi4wMTA0IDI2LjI2NzggMjIuMDk1OSAyNi43MTIyQzIyLjE4MTQgMjcuMTU2NSAyMi4xMzc1IDI3LjYxNzIgMjEuOTY5OCAyOC4wMzU4QzIxLjgwMjEgMjguNDU0NCAyMS41MTgyIDI4LjgxMjIgMjEuMTUzOSAyOS4wNjM5QzIwLjc4OTYgMjkuMzE1NiAyMC4zNjEyIDI5LjQ1IDE5LjkyMzEgMjkuNDVDMTkuMzM1NSAyOS40NSAxOC43NzIgMjkuMjA4NiAxOC4zNTY2IDI4Ljc3OUMxNy45NDExIDI4LjM0OTQgMTcuNzA3NyAyNy43NjY3IDE3LjcwNzcgMjcuMTU5MVoiIGZpbGw9IiNCNUI1QjUiLz4KPC9zdmc+Cg=='

/**
 * Extended Image Props interface that includes additional custom properties
 */
interface ExtendedImageProps
  extends Omit<NextImageProps, 'placeholder' | 'blurDataURL'> {
  /** Additional className for styling */
  className?: string
  /** Whether to use Next.js image optimization */
  optimized?: boolean
  /** Custom placeholder image to show on error */
  placeholderimage?: string
}

/**
 * UnCachedImage Component
 *
 * A wrapper around Next.js Image component with additional features:
 * - Loading state handling
 * - Error state handling with fallback
 * - Customizable placeholder
 * - Optimized loading behavior
 *
 * @param {ExtendedImageProps} props - Component props
 * @returns {JSX.Element} Rendered image component
 */
function UnCachedImage({
  className,
  src,
  optimized = false,
  placeholderimage = DEFAULT_PLACEHOLDER_IMAGE,
  alt = 'Image',
  ...props
}: ExtendedImageProps): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)

  const handleError = useCallback(() => {
    setError(true)
    setLoading(false)
  }, [])

  const handleLoad = useCallback(() => {
    setLoading(false)
  }, [])

  if (!src) {
    return <Skeleton className={className} />
  }
  return (
    <>
      <NextImage
        {...props}
        className={cn(className, 'transition-all duration-200 ease-in-out', {
          'hidden opacity-0': loading || error,
          'block opacity-100': !loading,
          'bg-neutral-300 dark:bg-neutral-700': error,
        })}
        unoptimized={!optimized}
        loading="eager"
        fetchPriority="high"
        src={!error ? src : placeholderimage}
        placeholder="blur"
        blurDataURL={placeholderimage}
        onLoad={handleLoad}
        onError={handleError}
        alt={alt}
      />
      {loading && !error && <Skeleton className={className} />}
    </>
  )
}

const Image = cache(UnCachedImage)
export default Image
