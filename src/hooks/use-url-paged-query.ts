import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_PAGINATION_LIMIT } from "@/constants";

type UseUrlPagedQueryOptions = {
  urlPage: number | undefined;
  totalPages: number | undefined;
  clampGuard?: boolean;
  scrollToTop?: boolean;
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

  // Pagination clicks happen at the bottom of the page, so the router's
  // scroll restoration remembers that spot and drops the user back at the
  // pagination bar when they navigate back/forward. Force paginated views
  // to open at the top instead — the effect runs after the router restores,
  // so it wins on POP navigations too.
  const lastScrolledPage = useRef<number | null>(page);
  useEffect(() => {
    if (!scrollToTop || lastScrolledPage.current === page) return;
    lastScrolledPage.current = page;
    window.scrollTo({ top: 0 });
  }, [page, scrollToTop]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const maxPage = clampGuard ? clampedTotalPages : (totalPages ?? 0);

      if (!maxPage || newPage < 1 || newPage > maxPage || newPage === page) {
        return;
      }

      setPendingPage(newPage);
      goToPage(newPage);
    },
    [clampGuard, clampedTotalPages, totalPages, page, goToPage],
  );

  return {
    page,
    isPending: pendingPage !== null && pendingPage !== page,
    totalPages: clampedTotalPages,
    handlePageChange,
  };
}
