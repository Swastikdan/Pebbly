"use client";
import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

/**
 * Interface defining the props for the ScrollContainer component.
 * @param children - The content to be rendered within the scrollable container.
 * @param isButtonsVisible - A boolean indicating whether to show the scroll buttons (default: true).
 */
interface ScrollContainerProps {
  children: React.ReactNode;
  isButtonsVisible?: boolean;
}

/**
 * A component that provides horizontal scrolling functionality with optional scroll buttons.
 * @param props - ScrollContainerProps interface containing children and isButtonsVisible.
 * @returns JSX element representing the scrollable container with optional buttons.
 */
const ScrollContainer: React.FC<ScrollContainerProps> = ({
  children,
  isButtonsVisible = true,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /**
   * Updates the state variables `canScrollLeft` and `canScrollRight` based on the current scroll position.
   */
  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
    }
  };

  /**
   * Scrolls the container to the left by 80% of the viewport width.
   */
  const scrollLeftFunc = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: -0.8 * window.innerWidth, // Scroll by 80% of the viewport width
        behavior: "smooth",
      });
    }
  };

  /**
   * Scrolls the container to the right by 80% of the viewport width.
   */
  const scrollRightFunc = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: 0.8 * window.innerWidth, // Scroll by 80% of the viewport width
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const currentScrollRef = scrollRef.current;
    updateScrollButtons();
    if (currentScrollRef) {
      currentScrollRef.addEventListener("scroll", updateScrollButtons);
    }
    return () => {
      if (currentScrollRef) {
        currentScrollRef.removeEventListener("scroll", updateScrollButtons);
      }
    };
  }, []);

  return (
    <div className="relative">
      {isButtonsVisible && (
        <Button
          onClick={scrollLeftFunc}
          disabled={!canScrollLeft}
          variant="secondary"
          size="icon"
          aria-label="Scroll left"
          className={`absolute left-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 transform rounded-full p-2 shadow-md transition-all duration-150 hover:bg-secondary active:scale-90 sm:scale-100 [&_svg]:size-6 ${
            canScrollLeft ? "hidden sm:block" : "hidden"
          }`}
        >
          <ChevronLeft size={32} className="font-bold" />
        </Button>
      )}
      <div
        ref={scrollRef}
        className="scrollbar-hidden relative overflow-x-auto"
      >
        <div className="w-max min-w-full">{children}</div>
      </div>
      {isButtonsVisible && (
        <Button
          onClick={scrollRightFunc}
          disabled={!canScrollRight}
          variant="secondary"
          size="icon"
          aria-label="Scroll right"
          className={`absolute right-2 top-1/2 z-10 size-10 -translate-y-1/2 transform rounded-full p-2 shadow-md transition-all duration-150 hover:bg-secondary active:scale-90 sm:scale-100 [&_svg]:size-6 ${
            canScrollRight ? "hidden sm:block" : "hidden"
          }`}
        >
          <ChevronRight size={32} className="font-bold" />
        </Button>
      )}
    </div>
  );
};

export { ScrollContainer };
