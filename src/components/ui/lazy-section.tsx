import { useEffect, useRef, useState } from "react";

interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  minHeight?: string;
  className?: string;
}

export function LazySection({
  children,
  fallback,
  rootMargin = "300px",
  minHeight = "280px",
  className,
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

  // Keep minHeight always to avoid CLS when the fallback is swapped for
  // content. `minHeight` is a lower bound so taller content still expands
  // without collapsing the placeholder that was measured during initial
  // paint. `content-visibility:auto` with `containIntrinsicSize: auto <size>`
  // keeps the off-screen cost low without discarding the size reservation
  // and preserves document height for content taller than minHeight.
  return (
    <div
      ref={ref}
      className={className}
      style={{
        minHeight,
        containIntrinsicSize: `auto ${minHeight}`,
        contentVisibility: "auto",
      }}
    >
      {hasIntersected ? children : fallback}
    </div>
  );
}
