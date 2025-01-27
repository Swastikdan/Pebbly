import * as React from 'react'

interface InfiniteScrollProps {
  /** Indicates if data is currently being loaded */
  isLoading: boolean
  /** Indicates if there are more items to load */
  hasMore: boolean
  /** Function to call when more items need to be loaded */
  next: () => unknown
  /** Intersection observer threshold (0 to 1). Default is 0 */
  threshold?: number
  /** Root element for intersection observer. Default is null (viewport) */
  root?: Element | Document | null
  /** Root margin for intersection observer. Default is "0px" */
  rootMargin?: string
  /** Whether to reverse the scroll direction. Default is false */
  reverse?: boolean
  /** Child elements to render */
  children: React.ReactNode
}

/**
 * InfiniteScroll component that automatically loads more content when the user scrolls near the bounds
 * @param props InfiniteScrollProps
 * @returns React component that implements infinite scrolling
 */
export default function InfiniteScroll({
  isLoading,
  hasMore,
  next,
  threshold = 0,
  root = null,
  rootMargin = '0px',
  reverse = false,
  children,
}: InfiniteScrollProps) {
  const observerTarget = React.useRef<HTMLDivElement>(null)
  const observer = React.useRef<IntersectionObserver | null>(null)
  const hasCalledNext = React.useRef(false)
  const timeoutRef = React.useRef<number | null>(null)

  // Reset hasCalledNext when loading completes or hasMore changes
  React.useEffect(() => {
    if (!isLoading) {
      hasCalledNext.current = false
    }
  }, [isLoading, hasMore])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    const safeThreshold = Math.min(Math.max(threshold, 0), 1)

    if (isLoading || !hasMore) {
      if (observer.current) {
        observer.current.disconnect()
      }
      return
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      if (
        entries[0].isIntersecting &&
        hasMore &&
        !isLoading &&
        !hasCalledNext.current
      ) {
        // Debounce the next() call
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = window.setTimeout(() => {
          hasCalledNext.current = true
          next()
        }, 300)
      }
    }

    if (observer.current) {
      observer.current.disconnect()
    }

    observer.current = new IntersectionObserver(handleIntersection, {
      threshold: safeThreshold,
      root,
      rootMargin,
    })

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.current.observe(currentTarget)
    }

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
      if (observer.current) {
        observer.current.disconnect()
      }
    }
  }, [hasMore, isLoading, next, threshold, root, rootMargin, reverse])

  if (!hasMore && !isLoading) {
    return <>{children}</>
  }

  const sentinel = (
    <div
      ref={observerTarget}
      className="w-full"
      style={{ height: '50px' }}
      aria-hidden="true"
      data-testid="infinite-scroll-sentinel"
      role="status"
      aria-live="polite"
      aria-label="Loading more content"
    />
  )

  return (
    <>
      {reverse && sentinel}
      {children}
      {!reverse && sentinel}
    </>
  )
}
