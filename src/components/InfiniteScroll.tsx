'use client'
import React, { useEffect, useRef } from 'react'

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
  const observerTarget = useRef<HTMLDivElement>(null)
  const observer = useRef<IntersectionObserver | null>(null)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect()
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
  }, [])

  useEffect(() => {
    if (isLoading || !hasMore) {
      if (observer.current) observer.current.disconnect()
      return
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0]

      if (entry.isIntersecting) {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current)

        debounceTimeout.current = setTimeout(() => {
          next()
        }, 150) // Debounce interval to avoid rapid calls
      }
    }

    observer.current = new IntersectionObserver(handleIntersection, {
      threshold,
      root,
      rootMargin,
    })

    const currentTarget = observerTarget.current
    if (currentTarget) observer.current.observe(currentTarget)

    return () => {
      if (observer.current) observer.current.disconnect()
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
