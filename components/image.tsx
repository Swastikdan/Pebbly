"use client";
import { memo, useState, useCallback } from "react";
import NextImage, { ImageProps } from "next/image";
import { Skeleton } from "@heroui/skeleton";

import { cn } from "@/lib/utils";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@/config/image";

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
    <div className="relative rounded-xl">
      {loading && !error && (
        <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-xl" />
      )}
      <NextImage
        alt={alt ?? "Image"}
        className={cn(
          "bg-secondary transition-opacity duration-300",
          loading && !error ? "opacity-0" : "opacity-100",
          props.className,
        )}
        {...props}
        unoptimized
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
