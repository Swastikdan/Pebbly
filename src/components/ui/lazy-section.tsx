import { useEffect, useRef, useState } from "react";

interface LazySectionProps {
	children: React.ReactNode;
	rootMargin?: string;
	minHeight?: string;
	className?: string;
}

export function LazySection({
	children,
	rootMargin = "300px",
	minHeight = "280px",
	className,
}: LazySectionProps) {
	const [hasIntersected, setHasIntersected] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (hasIntersected) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setHasIntersected(true);
				}
			},
			{ rootMargin },
		);

		const element = ref.current;
		if (element) {
			observer.observe(element);
		}

		return () => {
			if (element) {
				observer.unobserve(element);
			}
		};
	}, [hasIntersected, rootMargin]);

	return (
		<div
			ref={ref}
			className={className}
			style={{
				minHeight: hasIntersected ? undefined : minHeight,
			}}
		>
			{hasIntersected ? children : null}
		</div>
	);
}
