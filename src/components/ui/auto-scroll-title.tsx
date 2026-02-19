import { useLayoutEffect, useRef, useState } from "react";

interface AutoScrollTitleProps {
	text: string;
	className?: string;
	duration?: string;
}

export function AutoScrollTitle({
	text,
	className,
	duration = "10s",
}: AutoScrollTitleProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLSpanElement>(null);
	const [isOverflow, setIsOverflow] = useState(false);

	useLayoutEffect(() => {
		const container = containerRef.current;
		const measure = measureRef.current;
		if (!container || !measure) return;

		const check = () => {
			setIsOverflow(measure.scrollWidth > container.clientWidth);
		};

		check();

		const ro = new ResizeObserver(check);
		ro.observe(container);

		return () => ro.disconnect();
	}, []);

	return (
		<div
			ref={containerRef}
			className={`group relative w-full overflow-hidden whitespace-nowrap text-left ${
				className ?? ""
			}`}
			style={
				{
					"--marquee-duration": duration,
				} as React.CSSProperties
			}
		>
			{/* Hidden measurer */}
			<span
				ref={measureRef}
				className="pointer-events-none absolute -z-10 invisible whitespace-nowrap"
			>
				{text}
			</span>

			{/* Default truncated text */}
			<span
				className={`block truncate will-change-transform transition-opacity duration-300 ease-in-out ${
					isOverflow ? "group-hover:opacity-0" : ""
				}`}
			>
				{text}
			</span>

			{/* Smooth scrolling marquee on hover */}
			{isOverflow && (
				<div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100">
					<div
						className="flex w-max will-change-transform gap-8 motion-safe:animate-marquee motion-reduce:animate-none [animation-play-state:paused] group-hover:[animation-play-state:running]"
						style={
							{
								"--marquee-duration": duration,
							} as React.CSSProperties
						}
					>
						<span className="inline-block flex-shrink-0">{text}</span>
						<span className="inline-block flex-shrink-0" aria-hidden="true">
							{text}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
