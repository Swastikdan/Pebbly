"use client";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeftLine, ArrowRightLine } from "@/components/ui/icons";

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
  /* eslint-disable no-undef */
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
    <div className={cn("relative w-full overflow-hidden ", className)}>
      {isButtonsVisible && canScrollLeft && (
        <Button
          aria-label="Scroll left"
          className="-translate-y-1/2 pressable absolute top-1/2 left-4 z-20 hidden size-10 transform cursor-pointer items-center justify-center rounded-xl shadow-md backdrop-blur-sm sm:flex"
          variant="light"
          size="icon-lg"
          onClick={scrollLeftFunc}
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
          className="-translate-y-1/2 pressable absolute top-1/2 right-4 z-20 hidden size-10 transform cursor-pointer items-center justify-center rounded-xl shadow-md backdrop-blur-sm sm:flex"
          variant="light"
          size="icon-lg"
          onClick={scrollRightFunc}
        >
          <ArrowRightLine className="size-5" />
        </Button>
      )}
    </div>
  );
};
