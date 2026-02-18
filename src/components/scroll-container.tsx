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

const MOBILE_BREAKPOINT = 640;

export const ScrollContainer: React.FC<ScrollContainerProps> = ({
	children,
	isButtonsVisible = true,
	className,
	scrollPercentage = 0.9,
}) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const rafIdRef = useRef<number | null>(null);
	const scrollStateRef = useRef({ canScrollLeft: false, canScrollRight: false });
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);
	const [isDesktop, setIsDesktop] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const mediaQuery = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);
		const updateIsDesktop = () => setIsDesktop(mediaQuery.matches);
		updateIsDesktop();
		mediaQuery.addEventListener("change", updateIsDesktop);

		return () => {
			mediaQuery.removeEventListener("change", updateIsDesktop);
		};
	}, []);

	const isControlsEnabled = isButtonsVisible && isDesktop;

	const updateScrollButtons = useCallback(() => {
		if (!isControlsEnabled || !scrollRef.current) {
			return;
		}

		const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
		const nextCanScrollLeft = scrollLeft > 0;
		const nextCanScrollRight = Math.ceil(scrollLeft + clientWidth) < scrollWidth;

		if (scrollStateRef.current.canScrollLeft !== nextCanScrollLeft) {
			scrollStateRef.current.canScrollLeft = nextCanScrollLeft;
			setCanScrollLeft(nextCanScrollLeft);
		}

		if (scrollStateRef.current.canScrollRight !== nextCanScrollRight) {
			scrollStateRef.current.canScrollRight = nextCanScrollRight;
			setCanScrollRight(nextCanScrollRight);
		}
	}, [isControlsEnabled]);

	const scheduleButtonStateUpdate = useCallback(() => {
		if (rafIdRef.current !== null) {
			return;
		}

		rafIdRef.current = requestAnimationFrame(() => {
			rafIdRef.current = null;
			updateScrollButtons();
		});
	}, [updateScrollButtons]);

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

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!isControlsEnabled || !scrollRef.current) return;

			if (e.key === "ArrowLeft" && canScrollLeft) {
				e.preventDefault();
				scrollLeft();
			} else if (e.key === "ArrowRight" && canScrollRight) {
				e.preventDefault();
				scrollRight();
			}
		},
		[canScrollLeft, canScrollRight, isControlsEnabled, scrollLeft, scrollRight],
	);

	useEffect(() => {
		const currentScrollRef = scrollRef.current;
		if (!currentScrollRef || !isControlsEnabled) {
			if (scrollStateRef.current.canScrollLeft || scrollStateRef.current.canScrollRight) {
				scrollStateRef.current = { canScrollLeft: false, canScrollRight: false };
				setCanScrollLeft(false);
				setCanScrollRight(false);
			}
			return;
		}

		updateScrollButtons();
		currentScrollRef.addEventListener("scroll", scheduleButtonStateUpdate, {
			passive: true,
		});
		window.addEventListener("resize", updateScrollButtons);

		const resizeObserver = new ResizeObserver(updateScrollButtons);
		resizeObserver.observe(currentScrollRef);
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			currentScrollRef.removeEventListener("scroll", scheduleButtonStateUpdate);
			window.removeEventListener("resize", updateScrollButtons);
			window.removeEventListener("keydown", handleKeyDown);
			resizeObserver.disconnect();
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [handleKeyDown, isControlsEnabled, scheduleButtonStateUpdate, updateScrollButtons]);

	useEffect(() => {
		updateScrollButtons();
	}, [children, updateScrollButtons]);

	return (
		<div className={cn("relative w-full overflow-hidden", className)}>
			{isControlsEnabled && canScrollLeft && (
				<Button
					aria-label="Scroll left"
					className="absolute left-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 transform items-center justify-center rounded-xl backdrop-blur-sm transition-opacity hover:opacity-90 sm:flex"
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
				<div className="flex w-max items-center">{children}</div>
			</section>
			{isControlsEnabled && canScrollRight && (
				<Button
					aria-label="Scroll right"
					className="absolute right-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 transform items-center justify-center rounded-xl backdrop-blur-sm transition-opacity hover:opacity-90 sm:flex"
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
