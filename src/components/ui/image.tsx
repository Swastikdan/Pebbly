import { type ImageProps, Image as ReactImage } from "@unpic/react";
import { memo, useCallback, useState } from "react";

import { DEFAULT_PLACEHOLDER_IMAGE } from "@/constants";
import { cn } from "@/lib/utils";

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

	const handleError = useCallback(() => {
		setLoading(false);
		setSrc(fallbackImage ?? DEFAULT_PLACEHOLDER_IMAGE);
	}, [fallbackImage]);

	const handleLoad = useCallback(() => {
		setLoading(false);
	}, []);

	return (
		<ReactImage
			alt={alt ?? "Image"}
			className={cn(
				"bg-foreground/10",
				loading ? "animate-pulse" : "",
				props.className,
			)}
			{...props}
			src={src}
			onError={handleError}
			onLoad={handleLoad}
		/>
	);
};

const Image = memo(ImageComponent);

Image.displayName = "Image";

export { Image };
