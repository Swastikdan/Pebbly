"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import Image, { type ImageProps } from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@/constants";

type ImageWithFallbackProps = ImageProps & {
  fallbackImage?: string;
};

const ImageWithFallback = ({ ...props }: ImageWithFallbackProps) => {
  const [loading, setLoading] = React.useState(true);
  const [src, setSrc] = React.useState(props.src);
  React.useEffect(() => setSrc(props.src), [props.src]);

  const handleLoad = React.useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      setLoading(false);
      const target = e.target as HTMLImageElement;
      if (target.naturalWidth <= 16 && target.naturalHeight <= 16) {
        setSrc(props.fallbackImage ?? DEFAULT_PLACEHOLDER_IMAGE);
      }
    },
    [props.fallbackImage],
  );

  const handleError = React.useCallback(() => {
    setSrc(props.fallbackImage ?? DEFAULT_PLACEHOLDER_IMAGE);
  }, [props.fallbackImage]);

  return (
    <div className={cn("bg-accent relative", props.className)}>
      {loading && (
        <Skeleton
          className={cn("absolute inset-0 h-full w-full", props.className)}
        />
      )}
      <Image
        {...props}
        src={src}
        alt={props.alt || "Image"}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "object-cover",
          loading ? "opacity-0" : "opacity-100",
          props.className,
        )}
      />
    </div>
  );
};

export default React.memo(ImageWithFallback);
