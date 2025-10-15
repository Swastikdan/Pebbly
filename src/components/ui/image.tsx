import { memo, useState, useCallback } from "react";
import { Image as ImageComponenet, type ImageProps } from "@unpic/react";

import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@/constants";

const ImageComponent = ({
  src: initialSrc,
  fallbackImage,
  alt,
  ...props
}: ImageProps & {
  fallbackImage?: string;
}) => {
  const [src, setSrc] = useState(initialSrc);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleError = useCallback(() => {
    setError(true);
    setLoading(false);
    setSrc(fallbackImage ?? DEFAULT_PLACEHOLDER_IMAGE);
  }, [fallbackImage]);

  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  return (
    <div className="relative rounded-xl bg-foreground/10 overflow-hidden">
      <Skeleton
        className={cn(
          "absolute inset-0 z-10 h-full w-full rounded-xl transition-opacity duration-500",
          loading && !error
            ? "opacity-100"
            : "opacity-0 animate-none pointer-events-none",
        )}
      />
      <ImageComponenet
        alt={alt ?? "Image"}
        className={cn(
          "bg-foreground/10 transition-opacity duration-500",
          loading && !error ? "opacity-0" : "opacity-100",
          props.className,
        )}
        {...props}
        src={src}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
};

const Image = memo(ImageComponent);

Image.displayName = "Image";

export { Image };
