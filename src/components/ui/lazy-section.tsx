import { useEffect, useRef, useState } from "react";

interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  minHeight?: string;
  className?: string;
  /** Release the initial reservation once the lazy content has been evaluated. */
  releaseMinHeightAfterIntersect?: boolean;
}

export function LazySection({
  children,
  fallback,
  rootMargin = "300px",
  minHeight = "280px",
  className,
  releaseMinHeightAfterIntersect = false,
}: LazySectionProps) {
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasIntersected(true);
        }
      },
      { rootMargin },
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [rootMargin]);

  // Keep minHeight until the lazy content is evaluated to avoid CLS while it
  // loads. Some optional rails can resolve to null; those opt into releasing
  // the reservation after intersection so an empty rail does not leave a gap.
  // `content-visibility:auto` with `containIntrinsicSize` keeps off-screen
  // work low without discarding the initial size reservation.
  const reserveSpace = !releaseMinHeightAfterIntersect || !hasIntersected;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        minHeight: reserveSpace ? minHeight : undefined,
        containIntrinsicSize: reserveSpace ? `auto ${minHeight}` : undefined,
        contentVisibility: "auto",
      }}
    >
      {hasIntersected ? children : fallback}
    </div>
  );
}
