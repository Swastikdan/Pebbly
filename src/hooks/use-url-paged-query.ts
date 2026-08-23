import { useCallback, useState } from "react";

import { MAX_PAGINATION_LIMIT } from "@/constants";

type UseUrlPagedQueryOptions = {
  /** Page taken straight from the route search params. */
  urlPage: number | undefined;
  /** Raw total page count reported by the active query data, if any. */
  totalPages: number | undefined;
  /**
   * Validate requested pages against the pagination-limit-clamped count
   * instead of the raw total (the search route's existing behavior).
   */
  clampGuard?: boolean;
  /** Scroll back to the top of the window when the page changes. */
  scrollToTop?: boolean;
  /** Performs the route-specific navigation for the requested page. */
  goToPage: (page: number) => void;
};

export function useUrlPagedQuery({
  urlPage,
  totalPages,
  clampGuard = false,
  scrollToTop = false,
  goToPage,
}: UseUrlPagedQueryOptions) {
  const page = urlPage ?? 1;

  const [syncedPage, setSyncedPage] = useState(page);
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  if (page !== syncedPage) {
    setSyncedPage(page);
    setPendingPage(null);
  }

  const clampedTotalPages = Math.min(totalPages ?? 0, MAX_PAGINATION_LIMIT);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const maxPage = clampGuard ? clampedTotalPages : (totalPages ?? 0);

      if (!maxPage || newPage < 1 || newPage > maxPage || newPage === page) {
        return;
      }

      setPendingPage(newPage);
      if (scrollToTop && typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      goToPage(newPage);
    },
    [clampGuard, clampedTotalPages, totalPages, page, scrollToTop, goToPage],
  );

  return {
    page,
    isPending: pendingPage !== null && pendingPage !== page,
    totalPages: clampedTotalPages,
    handlePageChange,
  };
}
