import { type ImageProps, Image as ReactImage } from "@unpic/react";
import { memo, useCallback, useState } from "react";

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
	/** Tiny (e.g. TMDB w92/w300) version rendered as a blurred backdrop while the real image loads. */
	blurSrc?: string;
}) => {
	const [error, setError] = useState(false);
	// Without a blurSrc there is nothing to fade from, so start "loaded" to
	// avoid a permanent invisible backdrop when onLoad fires pre-hydration.
	const [loaded, setLoaded] = useState(() => !blurSrc);
	const [prevSrc, setPrevSrc] = useState(initialSrc);

	if (initialSrc !== prevSrc) {
		setPrevSrc(initialSrc);
		setError(false);
		setLoaded(!blurSrc);
	}

	const handleError = useCallback(() => {
		setError(true);
	}, []);

	const handleLoad = useCallback(() => {
		setLoaded(true);
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
		<div className={cn("relative overflow-hidden bg-foreground/10", className)}>
			{blurStyle && (
				<div
					aria-hidden="true"
					className={cn(
						"absolute inset-0 transition-opacity duration-300 ease-out",
						loaded && "opacity-0",
					)}
					style={blurStyle}
				/>
			)}
			<ReactImage
				alt={alt ?? "Image"}
				className={className}
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
