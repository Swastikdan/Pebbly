import { Image as ReactImage } from "@unpic/react";
import { memo, useCallback, useMemo, useState } from "react";

import type { ImageProps } from "@unpic/react";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@/constants";
import { tmdbSrcSet } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";

const ImageComponent = ({
  src: initialSrc,
  fallbackImage,
  alt,
  priority,
  blurSrc,
  className,
  ...props
}: ImageProps & {
  fallbackImage?: string;
  blurSrc?: string;
}) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prevSrc, setPrevSrc] = useState(initialSrc);

  if (initialSrc !== prevSrc) {
    setPrevSrc(initialSrc);
    setError(false);
    setLoaded(false);
  }

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  // Images that finish decoding before hydration never fire synthetic
  // onLoad events. Attaching the ref happens during commit, before paint,
  // so cached images skip the skeleton without a flash.
  const attachRef = useCallback((node: HTMLImageElement | null) => {
    if (!node?.complete) return;
    if (node.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setError(true);
    }
  }, []);

  const currentSrc = error
    ? (fallbackImage ?? DEFAULT_PLACEHOLDER_IMAGE)
    : initialSrc;

  // TMDB assets are size-variant ladders on one CDN URL, so a srcset lets
  // phones pull w185/w342 posters instead of the fixed w500/w780 JPEGs.
  // Only attached when the caller declared `sizes`: without it browsers
  // assume 100vw and would download larger files than the single src did.
  const tmdbSrcSetCandidates = useMemo(
    () => (props.sizes && !error ? tmdbSrcSet(currentSrc) : undefined),
    [props.sizes, currentSrc, error],
  );

  // Priority images are LCP candidates (first 2 trending cards). They must
  // be visible immediately for the browser to count LCP when the high-res
  // resource decodes, not after React flips `loaded` and fades out a
  // placeholder. Non-priority cards keep the blur/skeleton fade for
  // perceived polish. See `src/components/homepage-media.tsx:132` where
  // `priorityCount={2}` is set for the above-the-fold rail.
  const blurStyle =
    blurSrc && !error && !priority
      ? {
          backgroundImage: `url("${blurSrc}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined;

  return (
    <div className={cn("bg-foreground/10 relative overflow-hidden", className)}>
      {blurStyle ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 transform-gpu blur-md transition-opacity duration-500 ease-out",
            loaded ? "opacity-0" : "opacity-100",
          )}
          style={blurStyle}
        />
      ) : (
        !loaded &&
        !priority && <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <ReactImage
        ref={attachRef}
        alt={alt ?? "Image"}
        className={cn(
          className,
          "transition-opacity duration-500 ease-out",
          !loaded && !priority && "opacity-0",
        )}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        {...props}
        srcSet={tmdbSrcSetCandidates}
        src={currentSrc}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
};

const Image = memo(ImageComponent);

Image.displayName = "Image";

export { Image };
