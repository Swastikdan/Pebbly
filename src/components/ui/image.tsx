"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import Image, { type ImageProps } from "next/image";

const DEFAULT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA1MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTM1LjYxNTQgMjBIMTQuMzg0NkMxNC4wMTc0IDIwIDEzLjY2NTIgMjAuMTUwOSAxMy40MDU2IDIwLjQxOTRDMTMuMTQ1OSAyMC42ODc5IDEzIDIxLjA1MjEgMTMgMjEuNDMxOFYzOS41NjgyQzEzIDM5Ljk0NzkgMTMuMTQ1OSA0MC4zMTIxIDEzLjQwNTYgNDAuNTgwNkMxMy42NjUyIDQwLjg0OTEgMTQuMDE3NCA0MSAxNC4zODQ2IDQxSDM1LjYxNTRDMzUuOTgyNiA0MSAzNi4zMzQ4IDQwLjg0OTEgMzYuNTk0NCA0MC41ODA2QzM2Ljg1NDEgNDAuMzEyMSAzNyAzOS45NDc5IDM3IDM5LjU2ODJWMjEuNDMxOEMzNyAyMS4wNTIxIDM2Ljg1NDEgMjAuNjg3OSAzNi41OTQ0IDIwLjQxOTRDMzYuMzM0OCAyMC4xNTA5IDM1Ljk4MjYgMjAgMzUuNjE1NCAyMFpNMzQuMjMwOCAzMi44ODY0TDI5LjgwNTMgMjcuODk0QzI5LjcyMTYgMjcuNzk4MyAyOS42MTk4IDI3LjcyMTIgMjkuNTA2MiAyNy42Njc2QzI5LjM5MjcgMjcuNjEzOSAyOS4yNjk4IDI3LjU4NDggMjkuMTQ1IDI3LjU4MkMyOS4wMjAyIDI3LjU3OTIgMjguODk2MSAyNy42MDI4IDI4Ljc4MDQgMjcuNjUxM0MyOC42NjQ3IDI3LjY5OTggMjguNTU5OCAyNy43NzIyIDI4LjQ3MjEgMjcuODY0MUwyMy41MzYxIDMyLjk2ODRMMjguNTMzNiAzOC4xMzY0SDI1LjkyMzFMMjEuNDk4OSAzMy41NjEyQzIxLjMyNTcgMzMuMzgyMyAyMS4wOTA5IDMzLjI4MTggMjAuODQ2MiAzMy4yODE4QzIwLjYwMTQgMzMuMjgxOCAyMC4zNjY2IDMzLjM4MjMgMjAuMTkzNSAzMy41NjEyTDE1Ljc2OTIgMzguMTM2NFYyMi44NjM2SDM0LjIzMDhWMzIuODg2NFpNMTcuNzA3NyAyNy4xNTkxQzE3LjcwNzcgMjYuNzA2IDE3LjgzNzYgMjYuMjYzMSAxOC4wODExIDI1Ljg4NjNDMTguMzI0NSAyNS41MDk2IDE4LjY3MDUgMjUuMjE2IDE5LjA3NTMgMjUuMDQyNkMxOS40ODAxIDI0Ljg2OTIgMTkuOTI1NSAyNC44MjM4IDIwLjM1NTMgMjQuOTEyMkMyMC43ODUgMjUuMDAwNiAyMS4xNzk4IDI1LjIxODggMjEuNDg5NiAyNS41MzkyQzIxLjc5OTQgMjUuODU5NiAyMi4wMTA0IDI2LjI2NzggMjIuMDk1OSAyNi43MTIyQzIyLjE4MTQgMjcuMTU2NSAyMi4xMzc1IDI3LjYxNzIgMjEuOTY5OCAyOC4wMzU4QzIxLjgwMjEgMjguNDU0NCAyMS41MTgyIDI4LjgxMjIgMjEuMTUzOSAyOS4wNjM5QzIwLjc4OTYgMjkuMzE1NiAyMC4zNjEyIDI5LjQ1IDE5LjkyMzEgMjkuNDVDMTkuMzM1NSAyOS40NSAxOC43NzIgMjkuMjA4NiAxOC4zNTY2IDI4Ljc3OUMxNy45NDExIDI4LjM0OTQgMTcuNzA3NyAyNy43NjY3IDE3LjcwNzcgMjcuMTU5MVoiIGZpbGw9IiNCNUI1QjUiLz4KPC9zdmc+Cg==";

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
    <Image
      {...props}
      src={src}
      alt={props.alt}
      className={cn(
        loading ? "blur-[2px]" : "blur-0",
        "bg-secondary relative h-full w-full overflow-hidden",
        props.className,
      )}
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
      unoptimized
    />
  );
};

export default React.memo(ImageWithFallback);
// const LoadingSpinner = () => (
//   <div className="flex h-full w-full items-center justify-center">
//     <div className="border-muted-foreground h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
//   </div>
// );

// const ImageWithFallback = ({
//   src,
//   alt,
//   className,
//   fallbackImage,
// }: {
//   src: string;
//   alt: string;
//   className?: string;
//   fallbackImage?: string;
// }) => {
//   const [isLoading, setIsLoading] = React.useState(true);
//   const [hasError, setHasError] = React.useState(false);

//   const handleLoad = () => {
//     setIsLoading(false);
//     setHasError(false);
//   };

//   const handleError = () => {
//     setIsLoading(false);
//     setHasError(true);
//   };

//   // Reset states when src changes
//   React.useEffect(() => {
//     setIsLoading(true);
//     setHasError(false);
//   }, [src]);

//   return (
//     <div
//       className={cn(
//         "bg-secondary relative h-full w-full overflow-hidden",
//         className,
//       )}
//     >
//       {/* Loading state */}
//       {isLoading && (
//         <div className="bg-secondary absolute inset-0 z-10 flex items-center justify-center">
//           <LoadingSpinner />
//         </div>
//       )}

//       {/* Main image */}
//       <img
//         src={src}
//         alt={alt}
//         className={cn(
//           "h-full w-full object-cover transition-opacity duration-200",
//           isLoading || hasError ? "opacity-0" : "opacity-100",
//         )}
//         onLoad={handleLoad}
//         onError={handleError}
//       />

//       {/* Fallback image */}
//       {hasError && (
//         <div className="absolute inset-0 flex items-center justify-center">
//           <img
//             src={fallbackImage ?? DEFAULT_PLACEHOLDER_IMAGE}
//             alt={alt}
//             className="h-full w-full object-cover"
//           />
//         </div>
//       )}
//     </div>
//   );
// };

// export default React.memo(ImageWithFallback);
