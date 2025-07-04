"use client";
import { useState, useCallback, memo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import Image, { type ImageProps } from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA1MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTM1LjYxNTQgMjBIMTQuMzg0NkMxNC4wMTc0IDIwIDEzLjY2NTIgMjAuMTUwOSAxMy40MDU2IDIwLjQxOTRDMTMuMTQ1OSAyMC42ODc5IDEzIDIxLjA1MjEgMTMgMjEuNDMxOFYzOS41NjgyQzEzIDM5Ljk0NzkgMTMuMTQ1OSA0MC4zMTIxIDEzLjQwNTYgNDAuNTgwNkMxMy42NjUyIDQwLjg0OTEgMTQuMDE3NCA0MSAxNC4zODQ2IDQxSDM1LjYxNTRDMzUuOTgyNiA0MSAzNi4zMzQ4IDQwLjg0OTEgMzYuNTk0NCA0MC41ODA2QzM2Ljg1NDEgNDAuMzEyMSAzNyAzOS45NDc5IDM3IDM5LjU2ODJWMjEuNDMxOEMzNyAyMS4wNTIxIDM2Ljg1NDEgMjAuNjg3OSAzNi41OTQ0IDIwLjQxOTRDMzYuMzM0OCAyMC4xNTA5IDM1Ljk4MjYgMjAgMzUuNjE1NCAyMFpNMzQuMjMwOCAzMi44ODY0TDI5LjgwNTMgMjcuODk0QzI5LjcyMTYgMjcuNzk4MyAyOS42MTk4IDI3LjcyMTIgMjkuNTA2MiAyNy42Njc2QzI5LjM5MjcgMjcuNjEzOSAyOS4yNjk4IDI3LjU4NDggMjkuMTQ1IDI3LjU4MkMyOS4wMjAyIDI3LjU3OTIgMjguODk2MSAyNy42MDI4IDI4Ljc4MDQgMjcuNjUxM0MyOC42NjQ3IDI3LjY5OTggMjguNTU5OCAyNy43NzIyIDI4LjQ3MjEgMjcuODY0MUwyMy41MzYxIDMyLjk2ODRMMjguNTMzNiAzOC4xMzY0SDI1LjkyMzFMMjEuNDk4OSAzMy41NjEyQzIxLjMyNTcgMzMuMzgyMyAyMS4wOTA5IDMzLjI4MTggMjAuODQ2MiAzMy4yODE4QzIwLjYwMTQgMzMuMjgxOCAyMC4zNjY2IDMzLjM4MjMgMjAuMTkzNSAzMy41NjEyTDE1Ljc2OTIgMzguMTM2NFYyMi44NjM2SDM0LjIzMDhWMzIuODg2NFpNMTcuNzA3NyAyNy4xNTkxQzE3LjcwNzcgMjYuNzA2IDE3LjgzNzYgMjYuMjYzMSAxOC4wODExIDI1Ljg4NjNDMTguMzI0NSAyNS41MDk2IDE4LjY3MDUgMjUuMjE2IDE5LjA3NTMgMjUuMDQyNkMxOS40ODAxIDI0Ljg2OTIgMTkuOTI1NSAyNC44MjM4IDIwLjM1NTMgMjQuOTEyMkMyMC43ODUgMjUuMDAwNiAyMS4xNzk4IDI1LjIxODggMjEuNDg5NiAyNS41MzkyQzIxLjc5OTQgMjUuODU5NiAyMi4wMTA0IDI2LjI2NzggMjIuMDk1OSAyNi43MTIyQzIyLjE4MTQgMjcuMTU2NSAyMi4xMzc1IDI3LjYxNzIgMjEuOTY5OCAyOC4wMzU4QzIxLjgwMjEgMjguNDU0NCAyMS41MTgyIDI4LjgxMjIgMjEuMTUzOSAyOS4wNjM5QzIwLjc4OTYgMjkuMzE1NiAyMC4zNjEyIDI5LjQ1IDE5LjkyMzEgMjkuNDVDMTkuMzM1NSAyOS40NSAxOC43NzIgMjkuMjA4NiAxOC4zNTY2IDI4Ljc3OUMxNy45NDExIDI4LjM0OTQgMTcuNzA3NyAyNy43NjY3IDE3LjcwNzcgMjcuMTU5MVoiIGZpbGw9IiNCNUI1QjUiLz4KPC9zdmc+Cg==";

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
function useIntersectionObserverOnce(
  elementRef: React.RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [hasIntersected, setHasIntersected] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasIntersected) {
      // If no element or already intersected, no need to observe.
      observerRef.current?.disconnect();
      return;
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry?.isIntersecting) {
        setHasIntersected(true);
        observerRef.current?.disconnect(); // Disconnect once intersected
      }
    };

    observerRef.current = new IntersectionObserver(observerCallback, options);
    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [elementRef, options, hasIntersected]);

  return hasIntersected;
}

const ImageWithFallback = ({
  src,
  alt,
  className,
  fallbackImage = DEFAULT_PLACEHOLDER_IMAGE,
  ...props
}: ImageWithFallbackProps) => {
  const [loaded, setLoaded] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if the image should load based on intersection
  const shouldLoadImage = useIntersectionObserverOnce(containerRef, {
    root: null,
    rootMargin: "0px",
    threshold: 0,
  });

  // Set the actual image source when it comes into view
  useEffect(() => {
    if (shouldLoadImage && currentImageSrc === null) {
      setCurrentImageSrc(src);
    }
  }, [shouldLoadImage, src, currentImageSrc]);

  // Handler for successful image load
  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  // Handler for image load errors
  const handleError = useCallback(() => {
    if (currentImageSrc !== fallbackImage) {
      setCurrentImageSrc(fallbackImage);
      setLoaded(true); // Treat fallback image as loaded to hide skeleton
    }
  }, [currentImageSrc, fallbackImage]);

  // Memoize the Image component rendering for performance
  const renderImage = useCallback(() => {
    if (!shouldLoadImage || currentImageSrc === null) {
      return null; // Don't render Image component until it's in view and src is set
    }

    return (
      <Image
        src={currentImageSrc}
        alt={alt}
        className={cn(
          "absolute inset-0 h-full w-full rounded-md object-cover transition-opacity duration-300",
          {
            "opacity-100": loaded,
            "opacity-0": !loaded,
          },
        )}
        // Set fetchPriority to "high" when the image is in view, otherwise default or auto
        fetchPriority={
          shouldLoadImage ? (props.fetchPriority ?? "high") : "auto"
        }
        unoptimized={props.unoptimized ?? false}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    );
  }, [
    shouldLoadImage,
    currentImageSrc,
    loaded,
    alt,
    handleLoad,
    handleError,
    props,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("bg-secondary relative overflow-hidden", className)}
    >
      {/* Skeleton always present, its opacity toggled based on `loaded` state */}
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

export default memo(ImageWithFallback);
