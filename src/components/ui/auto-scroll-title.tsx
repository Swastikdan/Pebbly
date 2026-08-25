import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface AutoScrollTitleProps {
  text: string;
  className?: string;
  duration?: string;
}

export function AutoScrollTitle({
  text,
  className,
  duration = "10s",
}: AutoScrollTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !window.matchMedia("(hover: hover)").matches
    ) {
      return;
    }

    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const check = () => {
      setIsOverflow(measure.scrollWidth > container.clientWidth);
    };

    const ro = new ResizeObserver(check);
    ro.observe(container);

    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative w-full overflow-hidden text-left whitespace-nowrap",
        className,
      )}
      style={
        {
          "--marquee-duration": duration,
        } as React.CSSProperties
      }
    >
      <span
        ref={measureRef}
        className="pointer-events-none invisible absolute -z-10 whitespace-nowrap"
      >
        {text}
      </span>

      <span
        className={cn(
          "block truncate transition-opacity duration-300 ease-in-out",
          isOverflow && "group-hover:opacity-0",
        )}
      >
        {text}
      </span>

      {isOverflow && (
        <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100">
          <div
            className="motion-safe:animate-marquee flex w-max gap-8 will-change-transform [animation-play-state:paused] group-hover:[animation-play-state:running] motion-reduce:animate-none"
            style={
              {
                "--marquee-duration": duration,
              } as React.CSSProperties
            }
          >
            <span className="inline-block shrink-0">{text}</span>
            <span className="inline-block shrink-0" aria-hidden="true">
              {text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
