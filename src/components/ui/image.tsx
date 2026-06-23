import { type ImageProps, Image as ReactImage } from "@unpic/react";
import { memo, useCallback, useState } from "react";

import { DEFAULT_PLACEHOLDER_IMAGE } from "@/constants";
import { cn } from "@/lib/utils";

const ImageComponent = ({
	src: initialSrc,
	fallbackImage,
	alt,
	priority,
	...props
}: ImageProps & {
	fallbackImage?: string;
}) => {
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(true);
	const [prevSrc, setPrevSrc] = useState(initialSrc);

	// Reset state immediately if the initialSrc prop changes
	if (initialSrc !== prevSrc) {
		setPrevSrc(initialSrc);
		setError(false);
		setLoading(true);
	}

	const handleError = useCallback(() => {
		setError(true);
		setLoading(false);
	}, []);

	const handleLoad = useCallback(() => {
		setLoading(false);
	}, []);

	const currentSrc = error ? (fallbackImage ?? DEFAULT_PLACEHOLDER_IMAGE) : initialSrc;

	return (
		<ReactImage
			key={currentSrc}
			alt={alt ?? "Image"}
			className={cn(
				"bg-foreground/10",
				loading ? "animate-pulse" : "",
				props.className,
			)}
			loading={priority ? "eager" : "lazy"}
			fetchPriority={priority ? "high" : undefined}
			{...props}
			src={currentSrc}
			onError={handleError}
			onLoad={handleLoad}
		/>
	);
};

const Image = memo(ImageComponent);

Image.displayName = "Image";

export { Image };
