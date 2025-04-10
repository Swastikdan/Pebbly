"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

/**
 * Pagination component for displaying page numbers and navigation controls.
 * @param currentPage - The currently active page number.
 * @param totalPages - The total number of pages available.
 * @param onPageChange - Callback function to handle page changes.  Accepts the new page number as an argument.
 */
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Renders a pagination component with previous, next, and page number buttons.
 * Handles edge cases where there's only one page or less.  Displays ellipses (...) for omitted page numbers.
 * @param props - PaginationProps interface containing currentPage, totalPages, and onPageChange.
 * @returns JSX element representing the pagination component.  Returns null if totalPages is less than or equal to 1.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  } //Return null if there's only one page or less

  return (
    <nav
      className="flex items-center justify-center gap-5 font-medium md:gap-1"
      aria-label="Pagination Navigation"
    >
      {/* Previous Button */}
      <Button
        variant="ghost"
        className="border-input border px-2 pr-4 text-lg md:border-transparent md:text-base"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1} //Disable if on the first page
        aria-label="Previous Page"
      >
        <ChevronLeft />
        <span>Prev</span>
      </Button>
      <div className="bg-secondary/20 flex h-9 items-center justify-center gap-2 rounded-lg px-4 py-2 md:hidden">
        <span className="text-primary text-base font-medium">Page</span>
        <div className="flex items-center gap-2">
          <span className="text-base" aria-current="page">
            {currentPage}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground text-base">{totalPages}</span>
        </div>
      </div>
      <div className="hidden gap-2 md:flex" role="list">
        {/* Page 1 */}
        <Button
          variant={currentPage === 1 ? "secondary" : "ghost"} //Highlight if on page 1
          className="text-base"
          onClick={() => onPageChange(1)}
          aria-label="Page 1"
          size="icon"
          aria-current={currentPage === 1 ? "page" : undefined}
        >
          1
        </Button>

        {/* Ellipsis after Page 1 */}
        {currentPage > 4 && (
          <Button
            variant="link"
            className="cursor-default text-base"
            disabled
            aria-hidden="true"
          >
            <MoreHorizontal />
          </Button>
        )}

        {/* Middle Page Numbers */}
        {Array.from({ length: 5 }, (_, i) => {
          const pageNumber = currentPage - 2 + i;
          if (pageNumber > 1 && pageNumber < totalPages) {
            return (
              <Button
                key={pageNumber}
                variant={pageNumber === currentPage ? "secondary" : "ghost"} //Highlight current page
                className="text-base"
                size="icon"
                onClick={() => onPageChange(pageNumber)}
                aria-label={`Page ${pageNumber}`}
                aria-current={pageNumber === currentPage ? "page" : undefined}
              >
                {pageNumber}
              </Button>
            );
          }
          return null;
        })}

        {/* Ellipsis before Last Page */}
        {currentPage < totalPages - 3 && (
          <Button
            variant="link"
            className="cursor-default text-base"
            disabled
            aria-hidden="true"
          >
            <MoreHorizontal />
          </Button>
        )}

        {/* Last Page */}
        {totalPages > 1 && (
          <Button
            variant={currentPage === totalPages ? "secondary" : "ghost"} //Highlight if on last page
            className="text-base"
            onClick={() => onPageChange(totalPages)}
            aria-label={`Page ${totalPages}`}
            size="icon"
            aria-current={currentPage === totalPages ? "page" : undefined}
          >
            {totalPages}
          </Button>
        )}
      </div>
      {/* Next Button */}
      <Button
        variant="ghost"
        className="border-input border px-2 pl-4 text-lg md:border-transparent md:text-base"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages} //Disable if on the last page
        aria-label="Next Page"
      >
        Next
        <ChevronRight />
      </Button>
    </nav>
  );
}
