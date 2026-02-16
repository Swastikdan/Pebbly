import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeftLine, ArrowRightLine } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ScrollContainerProps {
	children: React.ReactNode;
	isButtonsVisible?: boolean;
	className?: string;
	scrollPercentage?: number;
}

export const ScrollContainer: React.FC<ScrollContainerProps> = ({
	children,
	isButtonsVisible = true,
	className,
	scrollPercentage = 0.9,
}) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	// Memoize the scroll button update function
	const updateScrollButtons = useCallback(() => {
		if (!scrollRef.current) return;

		const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;

		setCanScrollLeft(scrollLeft > 0);
		setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
	}, []);

	// Memoize scroll functions
	const scrollLeft = useCallback(() => {
		if (!scrollRef.current) return;

		const scrollAmount = Math.min(
			scrollRef.current.scrollLeft,
			scrollPercentage * scrollRef.current.clientWidth,
		);

		scrollRef.current.scrollBy({
			left: -scrollAmount,
			behavior: "smooth",
		});
	}, [scrollPercentage]);

	const scrollRight = useCallback(() => {
		if (!scrollRef.current) return;

		const { scrollWidth, scrollLeft, clientWidth } = scrollRef.current;
		const remainingScroll = scrollWidth - (scrollLeft + clientWidth);
		const scrollAmount = Math.min(
			remainingScroll,
			scrollPercentage * clientWidth,
		);

		scrollRef.current.scrollBy({
			left: scrollAmount,
			behavior: "smooth",
		});
	}, [scrollPercentage]);

	// Handle keyboard navigation
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!scrollRef.current) return;

			if (e.key === "ArrowLeft" && canScrollLeft) {
				e.preventDefault();
				scrollLeft();
			} else if (e.key === "ArrowRight" && canScrollRight) {
				e.preventDefault();
				scrollRight();
			}
		},
		[canScrollLeft, canScrollRight, scrollLeft, scrollRight],
	);

	useEffect(() => {
		const currentScrollRef = scrollRef.current;
		if (!currentScrollRef) return;

		// Initial check
		updateScrollButtons();

		// Set up event listeners
		currentScrollRef.addEventListener("scroll", updateScrollButtons);
		window.addEventListener("resize", updateScrollButtons);

		// Set up ResizeObserver for content changes
		const resizeObserver = new ResizeObserver(updateScrollButtons);
		resizeObserver.observe(currentScrollRef);

		// Add keyboard navigation
		if (isButtonsVisible) {
			window.addEventListener("keydown", handleKeyDown);
		}

		// Cleanup
		return () => {
			currentScrollRef.removeEventListener("scroll", updateScrollButtons);
			window.removeEventListener("resize", updateScrollButtons);
			window.removeEventListener("keydown", handleKeyDown);
			resizeObserver.disconnect();
		};
	}, [updateScrollButtons, isButtonsVisible, handleKeyDown]);

	// Update scroll buttons when children change
	useEffect(() => {
		updateScrollButtons();
	}, [updateScrollButtons]);

	return (
		<div className={cn("relative w-full overflow-hidden", className)}>
			{isButtonsVisible && canScrollLeft && (
				<Button
					aria-label="Scroll left"
					className="absolute left-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 transform items-center justify-center rounded-xl  backdrop-blur-sm transition-opacity hover:opacity-90 sm:flex"
					variant="light"
					size="icon-lg"
					onClick={scrollLeft}
					tabIndex={0}
				>
					<ArrowLeftLine className="size-5" />
				</Button>
			)}
			<section
				ref={scrollRef}
				aria-label="Scrollable content"
				className="scrollbar-hidden relative w-full overflow-x-auto scroll-smooth rounded-md"
			>
				<div ref={containerRef} className="flex w-max items-center">
					{children}
				</div>
			</section>
			{isButtonsVisible && canScrollRight && (
				<Button
					aria-label="Scroll right"
					className="absolute right-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 transform items-center justify-center rounded-xl  backdrop-blur-sm transition-opacity hover:opacity-90 sm:flex"
					variant="light"
					size="icon-lg"
					onClick={scrollRight}
					tabIndex={0}
				>
					<ArrowRightLine className="size-5" />
				</Button>
			)}
		</div>
	);
};
