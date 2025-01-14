import * as React from "react";

interface InfiniteScrollProps {
  /** Indicates if data is currently being loaded */
  isLoading: boolean;
  /** Indicates if there are more items to load */
  hasMore: boolean;
  /** Function to call when more items need to be loaded */
  next: () => unknown;
  /** Intersection observer threshold (0 to 1). Default is 1 */
  threshold?: number;
  /** Root element for intersection observer. Default is null (viewport) */
  root?: Element | Document | null;
  /** Root margin for intersection observer. Default is "0px" */
  rootMargin?: string;
  /** Whether to reverse the scroll direction. Default is false */
  reverse?: boolean;
  /** Child elements to render */
  children: React.ReactNode;
}

/**
 * InfiniteScroll component that automatically loads more content when the user scrolls near the bottom
 * @param props InfiniteScrollProps
 * @returns React component that implements infinite scrolling
 */
export default function InfiniteScroll({
  isLoading,
  hasMore,
  next,
  threshold = 1,
  root = null,
  rootMargin = "0px",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reverse = false,
  children,
}: InfiniteScrollProps) {
  const observerTarget = React.useRef<HTMLDivElement>(null);
  // @ts-expect-error IntersectionObserver is not available in Node
  const observer = React.useRef<IntersectionObserver>();
  const hasCalledNext = React.useRef(false);
  // @ts-expect-error NodeJS.Timeout is not available in Node
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  // Reset hasCalledNext when loading completes or hasMore changes
  React.useEffect(() => {
    if (!isLoading) {
      hasCalledNext.current = false;
    }
  }, [isLoading, hasMore]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const safeThreshold = threshold < 0 || threshold > 1 ? 1 : threshold;

    if (isLoading || !hasMore) {
      if (observer.current) {
        observer.current.disconnect();
      }
      return;
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
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          hasCalledNext.current = true;
          next();
        }, 0); // 300ms debounce
      }
    };

    if (observer.current) {
      observer.current.disconnect();
    }

    observer.current = new IntersectionObserver(handleIntersection, {
      threshold: safeThreshold,
      root,
      rootMargin,
    });

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.current.observe(currentTarget);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [hasMore, isLoading, next, threshold, root, rootMargin]);

  if (!hasMore && !isLoading) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div
        ref={observerTarget}
        className="w-full"
        style={{ height: "1px" }}
        aria-hidden="true"
        data-testid="infinite-scroll-sentinel"
      />
    </>
  );
}
