"use client";
import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        0.8 * scrollRef.current.clientWidth,
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
        0.8 * scrollRef.current.clientWidth,
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
          variant="link"
          size="icon"
          aria-label="Scroll left"
          className="bg-secondary hover:bg-secondary/90 dark:bg-primary hover:dark:bg-primary/90 text-secondary-foreground dark:text-primary-foreground absolute top-1/2 left-4 z-10 hidden size-10 -translate-y-1/2 transform cursor-pointer items-center justify-center rounded-xl shadow-md transition-all duration-150 active:scale-90 sm:flex sm:scale-100"
        >
          <ChevronLeft size={32} className="size-5" />
        </Button>
      )}
      <div
        ref={scrollRef}
        className="scrollbar-hidden relative w-full overflow-x-auto scroll-smooth rounded-md"
        role="region"
        aria-label="Scrollable content"
      >
        <div ref={containerRef} className="flex w-max items-center">
          {children}
        </div>
      </div>
      {isButtonsVisible && canScrollRight && (
        <Button
          onClick={scrollRightFunc}
          variant="link"
          size="icon"
          className="bg-background dark:bg-foreground text-foreground dark:text-background absolute top-1/2 right-4 z-10 hidden size-10 -translate-y-1/2 transform cursor-pointer items-center justify-center rounded-xl shadow-md transition-all duration-150 active:scale-90 sm:flex sm:scale-100"
          aria-label="Scroll right"
        >
          <ChevronRight size={32} className="size-5" />
        </Button>
      )}
    </div>
  );
};
