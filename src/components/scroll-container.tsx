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
	const contentRef = useRef<HTMLDivElement>(null);
	const rafIdRef = useRef<number | null>(null);
	const scrollStateRef = useRef({
		canScrollLeft: false,
		canScrollRight: false,
	});
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
		const nextCanScrollRight =
			Math.ceil(scrollLeft + clientWidth) < scrollWidth;

		if (
			nextCanScrollLeft !== scrollStateRef.current.canScrollLeft ||
			nextCanScrollRight !== scrollStateRef.current.canScrollRight
		) {
			scrollStateRef.current = {
				canScrollLeft: nextCanScrollLeft,
				canScrollRight: nextCanScrollRight,
			};
			setCanScrollLeft(nextCanScrollLeft);
			setCanScrollRight(nextCanScrollRight);
		}
	}, [isControlsEnabled]);

	const scheduleButtonStateUpdate = useCallback(() => {
		if (rafIdRef.current !== null) {
			cancelAnimationFrame(rafIdRef.current);
		}
		rafIdRef.current = requestAnimationFrame(() => {
			updateScrollButtons();
			rafIdRef.current = null;
		});
	}, [updateScrollButtons]);

	const scroll = useCallback(
		(direction: "left" | "right") => {
			if (!scrollRef.current) return;
			const { clientWidth } = scrollRef.current;
			const scrollAmount = clientWidth * scrollPercentage;
			scrollRef.current.scrollBy({
				left: direction === "left" ? -scrollAmount : scrollAmount,
				behavior: "smooth",
			});
			scheduleButtonStateUpdate();
		},
		[scrollPercentage, scheduleButtonStateUpdate],
	);

	const scrollLeft = useCallback(() => scroll("left"), [scroll]);
	const scrollRight = useCallback(() => scroll("right"), [scroll]);

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
			if (
				scrollStateRef.current.canScrollLeft ||
				scrollStateRef.current.canScrollRight
			) {
				scrollStateRef.current = {
					canScrollLeft: false,
					canScrollRight: false,
				};
				setCanScrollLeft(false);
				setCanScrollRight(false);
			}
			return;
		}

		scheduleButtonStateUpdate();
		currentScrollRef.addEventListener("scroll", scheduleButtonStateUpdate, {
			passive: true,
		});
		window.addEventListener("resize", scheduleButtonStateUpdate);

		const resizeObserver = new ResizeObserver(scheduleButtonStateUpdate);
		resizeObserver.observe(currentScrollRef);
		if (contentRef.current) {
			resizeObserver.observe(contentRef.current);
		}
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			currentScrollRef.removeEventListener("scroll", scheduleButtonStateUpdate);
			window.removeEventListener("resize", scheduleButtonStateUpdate);
			window.removeEventListener("keydown", handleKeyDown);
			resizeObserver.disconnect();
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [handleKeyDown, isControlsEnabled, scheduleButtonStateUpdate]);

	return (
		<div className={cn("relative w-full overflow-hidden", className)}>
			{isControlsEnabled && canScrollLeft && (
				<>
					<div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
					<Button
						aria-label="Scroll left"
						className="absolute left-2 top-1/2 z-20 hidden size-9 -translate-y-1/2 transform items-center justify-center rounded-lg shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 sm:flex"
						variant="light"
						size="icon"
						onClick={scrollLeft}
						tabIndex={0}
					>
						<ArrowLeftLine className="size-4" />
					</Button>
				</>
			)}
			<section
				ref={scrollRef}
				aria-label="Scrollable content"
				className="scrollbar-hidden relative w-full overflow-x-auto scroll-smooth rounded-md scroll-snap-x"
			>
				<div ref={contentRef} className="flex w-max items-center">
					{children}
				</div>
			</section>
			{isControlsEnabled && canScrollRight && (
				<>
					<div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
					<Button
						aria-label="Scroll right"
						className="absolute right-2 top-1/2 z-20 hidden size-9 -translate-y-1/2 transform items-center justify-center rounded-lg shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 sm:flex"
						variant="light"
						size="icon"
						onClick={scrollRight}
						tabIndex={0}
					>
						<ArrowRightLine className="size-4" />
					</Button>
				</>
			)}
		</div>
	);
};
