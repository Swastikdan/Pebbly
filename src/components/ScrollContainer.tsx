"use client";
import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface ScrollContainerProps {
  children: React.ReactNode;
  isButtonsVisible?: boolean;
  className?: string;
}

export const ScrollContainer: React.FC<ScrollContainerProps> = ({
  children,
  isButtonsVisible = true,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  const scrollLeftFunc = () => {
    if (scrollRef.current) {
      const scrollAmount = Math.min(
        scrollRef.current.scrollLeft,
        0.8 * scrollRef.current.clientWidth
      );
      scrollRef.current.scrollBy({
        left: -scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const scrollRightFunc = () => {
    if (scrollRef.current) {
      const remainingScroll =
        scrollRef.current.scrollWidth -
        (scrollRef.current.scrollLeft + scrollRef.current.clientWidth);
      const scrollAmount = Math.min(
        remainingScroll,
        0.8 * scrollRef.current.clientWidth
      );
      scrollRef.current.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const currentScrollRef = scrollRef.current;

    const handleResize = () => {
      updateScrollButtons();
    };

    handleResize();
    updateScrollButtons();

    if (currentScrollRef) {
      currentScrollRef.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", handleResize);

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(currentScrollRef);
    }

    return () => {
      if (currentScrollRef) {
        currentScrollRef.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", handleResize);
      }
    };
  }, [children]);

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      {isButtonsVisible && canScrollLeft && (
        <Button
          onClick={scrollLeftFunc}
          variant="secondary"
          size="icon"
          aria-label="Scroll left"
          className="absolute left-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 transform rounded-full p-2 shadow-md transition-all duration-150 hover:bg-secondary active:scale-90 sm:block sm:scale-100 [&_svg]:size-6"
        >
          <ChevronLeft size={32} className="font-bold" />
        </Button>
      )}
      <div
        ref={scrollRef}
        className="scrollbar-hidden relative w-full overflow-x-auto scroll-smooth rounded-xl"
      >
        <div ref={containerRef} className="flex w-max items-center">
          {children}
        </div>
      </div>
      {isButtonsVisible && canScrollRight && (
        <Button
          onClick={scrollRightFunc}
          variant="secondary"
          size="icon"
          aria-label="Scroll right"
          className="absolute right-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 transform rounded-full p-2 shadow-md transition-all duration-150 hover:bg-secondary active:scale-90 sm:block sm:scale-100 [&_svg]:size-6"
        >
          <ChevronRight size={32} className="font-bold" />
        </Button>
      )}
    </div>
  );
};
