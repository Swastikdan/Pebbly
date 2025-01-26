import * as React from 'react'

interface InfiniteScrollProps {
  isLoading: boolean
  hasMore: boolean
  next: () => unknown
  threshold?: number
  root?: Element | Document | null
  rootMargin?: string
  reverse?: boolean
  children: React.ReactNode
}

export default function InfiniteScroll({
  isLoading,
  hasMore,
  next,
  threshold = 0.1,
  root = null,
  rootMargin = '0px',
  reverse = false,
  children,
}: InfiniteScrollProps) {
  const observerTarget = React.useRef<HTMLDivElement>(null)
  const observer = React.useRef<IntersectionObserver | null>(null)
  const hasCalledNext = React.useRef(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
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
      const entry = entries[0]

      if (entry.isIntersecting) {
        if (!hasCalledNext.current && hasMore && !isLoading) {
          hasCalledNext.current = true
          if (timeoutRef.current) clearTimeout(timeoutRef.current)

          timeoutRef.current = setTimeout(() => {
            next()
          }, 100)
        }
      } else {
        hasCalledNext.current = false
      }
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
      if (observer.current) {
        observer.current.disconnect()
      }
    }
  }, [hasMore, isLoading, next, threshold, root, rootMargin])

  return (
    <>
      {children}
      <div
        ref={observerTarget}
        className="sentinel"
        style={{
          height: '1px',
          width: '1px',
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
        aria-hidden="true"
        data-testid="infinite-scroll-sentinel"
      />
    </>
  )
}
