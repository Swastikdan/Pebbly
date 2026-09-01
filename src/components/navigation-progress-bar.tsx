import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

interface NavigationProgressBarProps {
  delay?: number;
}

export function NavigationProgressBar({
  delay = 80,
}: NavigationProgressBarProps) {
  // Use location vs resolvedLocation for immediate feedback.
  // `s.status === "pending"` is gated by pendingMs (250 ms) which intentionally
  // delays the full-screen DefaultLoader to avoid flashing on fast cached
  // navigations. The progress bar must NOT be gated: users need to see
  // feedback within ~100 ms of tapping a link, otherwise the app feels
  // frozen until the new page's loader resolves and then swaps in the fully
  // rendered page. Comparing `location` (pending URL, updates on navigation
  // start) vs `resolvedLocation` (committed URL, updates after loaders
  // commit) gives us an immediate signal, with a pending fallback for
  // edge cases like redirects where both hrefs briefly align.
  const isNavigating = useRouterState({
    select: (s) => {
      const href = s.location.href;
      const resolvedHref = s.resolvedLocation?.href ?? href;
      return href !== resolvedHref || s.status === "pending";
    },
  });
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isNavigating) {
      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }

      delayTimerRef.current = setTimeout(() => {
        setVisible(true);
        setProgress(20);

        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev < 60) return prev + 15;
            if (prev < 80) return prev + 5;
            if (prev < 92) return prev + 1.5;
            return prev;
          });
        }, 150);
      }, delay);
    } else {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (visible) {
        setProgress(100);
        finishTimerRef.current = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 250);
      }
    }

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, [isNavigating, visible, delay]);

  if (!visible && progress === 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="via-primary h-full w-full origin-left bg-gradient-to-r from-blue-500 to-blue-400 transition-transform duration-200 ease-out"
        style={{
          transform: `scaleX(${progress / 100})`,
        }}
      />
    </div>
  );
}
