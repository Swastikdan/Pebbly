import { Image as ReactImage } from "@unpic/react";
import { memo, useCallback, useState } from "react";

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

  const blurStyle =
    blurSrc && !error
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
            "absolute inset-0 transition-opacity duration-300 ease-out",
            loaded && "opacity-0",
          )}
          style={blurStyle}
        />
      ) : (
        !loaded && <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <ReactImage
        ref={attachRef}
        alt={alt ?? "Image"}
        className={cn(
          className,
          "transition-opacity duration-300 ease-out",
          !loaded && "opacity-0",
        )}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        {...props}
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
