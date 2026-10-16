import { Image as ReactImage } from "@unpic/react";
import { memo, useCallback, useRef, useState } from "react";

import type { ImageProps } from "@unpic/react";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@/constants";
import { cn } from "@/lib/utils";

const ImageComponent = ({
  src: initialSrc,
  fallbackImage,
  alt,
  priority,
  blurSrc,
  placeholderText,
  className,
  ...props
}: ImageProps & {
  fallbackImage?: string;
  blurSrc?: string;
  /** Optional text shown as a fallback when the image fails to load. */
  placeholderText?: string;
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
    // Keep the skeleton covering the image until the browser has decoded the
    // selected resource. This avoids revealing a partially decoded image.
    const image = imageRef.current;
    if (!image) return;
    void image.decode().then(
      () => setLoaded(true),
      () => setLoaded(true),
    );
  }, []);

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Images that finish decoding before hydration never fire synthetic
  // onLoad events. Attaching the ref happens during commit, before paint,
  // so cached images skip the skeleton without a flash.
  const attachRef = useCallback((node: HTMLImageElement | null) => {
    imageRef.current = node;
    if (!node?.complete) return;
    if (node.naturalWidth > 0) {
      void node.decode().then(
        () => setLoaded(true),
        () => setLoaded(true),
      );
    } else {
      setError(true);
    }
  }, []);

  const currentSrc = error
    ? (fallbackImage ?? DEFAULT_PLACEHOLDER_IMAGE)
    : initialSrc;

  return (
    <div
      className={cn(
        "bg-foreground/10 relative overflow-hidden outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10",
        className,
      )}
    >
      {/* Centered title text — always rendered while the image hasn't
          successfully loaded. For non-priority images the skeleton (z-10)
          sits on top so this is invisible until the skeleton fades out on
          error. For priority images (no skeleton) it acts as a pleasant
          centered placeholder while the image decodes. */}
      {!loaded && placeholderText && (
        <div
          aria-hidden="true"
          className="text-muted-foreground absolute inset-0 z-0 flex items-center justify-center p-2 text-center text-xs leading-snug font-semibold text-balance"
        >
          <span className="line-clamp-4">{placeholderText}</span>
        </div>
      )}

      {/* Shimmer skeleton — covers the entire area (including the text
          above) while loading. Fades out once the image loads or errors
          so the real image / text fallback can show through. */}
      <Skeleton
        className={cn(
          "absolute inset-0 z-10 rounded-none transition-opacity duration-500 ease-out",
          (loaded || error) &&
            "pointer-events-none opacity-0 [animation-play-state:paused] [&_*]:[animation-play-state:paused] [&::before]:[animation-play-state:paused]",
        )}
      />

      <ReactImage
        ref={attachRef}
        alt={alt ?? "Image"}
        className={cn(
          className,
          "transition-opacity duration-500 ease-out",
          !loaded && "opacity-0",
          !loaded && "text-transparent",
        )}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        {...props}
        srcSet={undefined}
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
