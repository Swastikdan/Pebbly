"use client";
import { useState, useCallback, memo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import Image, { type ImageProps } from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWd0aD0iNTAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA1MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTM1LjYxNTQgMjBIMTQuMzg0NkMxNC4wMTc0IDIwIDEzLjY2NTIgMjAuMTUwOSAxMy40MDU2IDIwLjQxOTRDMTMuMTQ1OSAyMC42NjE5IDEzIDIxLjA1MjEgMTMgMjEuNDMxOFYzOS41NjgyQzEzIDM5LjU4NzkgMTMuMTQ1OSA0MC4zMTIxIDEzLjQwNTYgNDAuNTgwNkMxMy42NjUyIDQwLjg0OTEgMTQuMDE3NCA0MSAxNC4zODQ2IDQxSDM1LjYxNTRDMzUuOTgyNiA0MSAzNi4zMzQ4IDQwLjg0OTEgMzYuNTk0NCA0MC41ODA2QzM2Ljg1NDEgNDAuMzEyMSAzNyAzOS45NDc5IDM3IDM5LjU2ODJWMjEuNDMxOEMzNyAyMS4wNTIxIDM2LjgyNTEgMjAuNjg3OSAzNi41OTQ0IDIwLjQxOTRDMzYuMzM0OCAyMC4xNTA5IDM1Ljk4MjYgMjAgMzUuNjE1NCAyMFpNMzQuMjMwOCAzMi44ODY0TDI5LjgwNTMgMjcuODk0QzI5LjcyMTYgMjcuNzk4MyAyOS42MTk4IDI3LjcyMTIgMjkuNTA2MiAyNy42Njc2QzI5LjM5MjcgMjcuNjEzOSAyOS4yNjk4IDI3LjU4NDggMjkuMTQ1IDI3LjU4MkMyOS4wMjAyIDI3LjU3OTIgMjguODk2MSAyNy42MDI4IDI4LjE3ODA0IDI3LjY1MTMJMjguNjY0NyAyNy42OTk4IDI4LjU1OTggMjcuNzcyMiAyOC40NzIxIDI3Ljg2NDFM MjMuNTM2MSAzMi45Njg0TDI4LjUzMzYgMzguMTM2NEgyNS45MjMxTDIxLjQ5ODkgMzMuNTYxMkMyMS4zMjU3IDMzLjM4MjMgMjEuMDkwOSAzMy4yODE4IDIwLjg0NjIgMzMuMjgxOEMyMC42MDE0IDMzLjI4MTggMjAuMzY2NiAzMy4zODIzIDIwLjE5MzUgMzMuNTYxMkwxNS43NjkyIDM4LjEzNjRWMjIuODYzNkgzNC4yMzA4VjMyLjg4NjRaTTE3LjcwNzcgMjcuMTU5MUMxNy43MDc3IDI2LjcwNiAxNy44Mzc2IDI2LjI2MzEgMTguMDgxMSAyNS44ODYzQzE4LjMyNDUgMjUuNTA5NiAxOC42NzY1IDI1LjIxNiAxOS4wNzUzIDI1LjA0MjZDMTkuNDgwMSAyNC44NjkyIDE5LjkyNTUgMjQuODI2OCAyMC4zNTUzIDI0LjkyMjJDIDIwLjM3ODUgMjUuMDAwNiAyMS4xNzk4IDI1LjIxODggMjEuNDg5NiAyNS41MzkyQzIxLjc5OTQgMjUuODU5NiAyMi4wMTA0IDI2LjI2NzggMjIuMDk1OSAyNi43MTIyQzIyLjE4MTQgMjcuMTU2NSAyMi4xMzc1IDI3LjYxNzIgMjEuOTY5OCAyOC4wMzU4QzIxLjgwMjEgMjguNDU0NCAyMS41MTgyIDI4LjgxMjIgMjEuMTUzOSAyOS4wNjM5QzIwLjc4OTYgMjkuMzE1NiAyMC4zNjEyIDI5LjQ1IDE5LjkyMzEgMjkuNDVDMTkuMzM1NSAyOS40NSAxOC43NzIgMjkuMjA4NiAxOC4zNTY2IDI4LjY1OTRDMTcuOTQxMSAyOC4zNDk0IDE3.NzA3NyAyNy43NjY3IDE3.NzA3NyAyNy4xNTkxWiIgZmlsbD0iI0I1QjVCNSIvPgo8L3N2Zz4K";

type ImageWithFallbackProps = ImageProps & {
  src: string;
  alt: string;
  className?: string;
  fallbackImage?: string;
};

/**
 * Custom hook to observe an element's intersection with the viewport.
 * It stops observing once the element has intersected.
 * @param elementRef The ref to the DOM element to observe.
 * @param options Options for the IntersectionObserver.
 * @returns A boolean indicating whether the element has intersected.
 */
function useIntersectionObserverOnceOptimized(
  elementRef: React.RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [hasIntersected, setHasIntersected] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // If it has already intersected, no need to set up an observer.
    // Also disconnect any existing observer if hasIntersected is true.
    if (hasIntersected) {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0]; // Get the first entry

      if (entry && entry.isIntersecting) {
        setHasIntersected(true);
        // Disconnect immediately after intersection
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      }
    };

    // Create a new IntersectionObserver instance and store it in the ref
    observerRef.current = new IntersectionObserver(observerCallback, options);
    observerRef.current.observe(element);

    return () => {
      // Clean up the observer when the component unmounts or dependencies change
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [elementRef, options, hasIntersected]); // hasIntersected in dependencies ensures effect re-runs when it becomes true

  return hasIntersected;
}

const ImageComponent = ({
  src,
  alt,
  className,
  fallbackImage = DEFAULT_PLACEHOLDER_IMAGE,
  ...props
}: ImageWithFallbackProps) => {
  const [loaded, setLoaded] = useState(false);
  // Reverted to useState for imageSrc. This is necessary for React to re-render the <Image>
  // component when the src changes from null to the actual image URL.
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const shouldLoadImage = useIntersectionObserverOnceOptimized(containerRef, {
    root: null,
    rootMargin: "0px", // Load when 0px away from viewport
    threshold: 0, // Trigger when any part of the target is visible
  });

  // Effect to set the imageSrc state when the component comes into view.
  // This will trigger a re-render and cause the <Image> component to load.
  useEffect(() => {
    if (shouldLoadImage && imageSrc === null) {
      // Only set if in view AND not already set
      setImageSrc(src);
    }
  }, [shouldLoadImage, src, imageSrc]); // imageSrc dependency is crucial to avoid infinite loop

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    // Only set fallback if the current imageSrc is not already the fallback
    if (imageSrc !== fallbackImage) {
      setImageSrc(fallbackImage);
      setLoaded(true); // Treat fallback load as "loaded" for skeleton removal
    }
  }, [imageSrc, fallbackImage]); // Dependency on imageSrc ensures correct check

  // Memoize the Image component rendering to prevent re-renders if props haven't changed.
  const renderImage = useCallback(() => {
    // Only render the Image component if it should load and its src is available
    if (!shouldLoadImage || imageSrc === null) {
      return null;
    }

    return (
      <Image
        src={imageSrc} // Use the state variable here
        alt={alt}
        className={cn(
          "absolute inset-0 h-full w-full rounded-md object-cover transition-opacity duration-300",
          {
            "opacity-100": loaded,
            "opacity-0": !loaded,
          },
        )}
        fetchPriority={
          props.fetchPriority || (shouldLoadImage ? "high" : "auto") || "auto"
        }
        unoptimized={props.unoptimized || false}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    );
  }, [
    shouldLoadImage,
    imageSrc,
    loaded,
    alt,
    className,
    handleLoad,
    handleError,
    props,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
    >
      {/* Skeleton is always present but its opacity is controlled */}
      <Skeleton
        className={cn(
          "absolute inset-0 animate-none transition-opacity duration-300",
          className,
          {
            "opacity-0": loaded,
            "opacity-100": !loaded,
          },
        )}
      />

      {renderImage()}
    </div>
  );
};

export default memo(ImageComponent);
