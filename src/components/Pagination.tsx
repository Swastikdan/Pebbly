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
  if (totalPages <= 1) return null; //Return null if there's only one page or less

  return (
    <div className="flex items-center justify-center gap-1 font-medium">
      {/* Previous Button */}
      <Button
        variant="ghost"
        className="px-2 text-base"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1} //Disable if on the first page
      >
        <ChevronLeft />
        <span className="sm:hidden">Prev</span>
        <span className="hidden sm:block">Previous</span>
      </Button>

      {/* Page 1 */}
      <Button
        variant={currentPage === 1 ? "secondary" : "ghost"} //Highlight if on page 1
        className="text-base"
        onClick={() => onPageChange(1)}
      >
        1
      </Button>

      {/* Ellipsis after Page 1 */}
      {currentPage > 4 && (
        <Button variant="link" className="cursor-default text-base" disabled>
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
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          );
        }
        return null;
      })}

      {/* Ellipsis before Last Page */}
      {currentPage < totalPages - 3 && (
        <Button variant="link" className="cursor-default text-base" disabled>
          <MoreHorizontal />
        </Button>
      )}

      {/* Last Page */}
      {totalPages > 1 && (
        <Button
          variant={currentPage === totalPages ? "secondary" : "ghost"} //Highlight if on last page
          className="text-base"
          onClick={() => onPageChange(totalPages)}
        >
          {totalPages}
        </Button>
      )}

      {/* Next Button */}
      <Button
        variant="ghost"
        className="px-2 text-base"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages} //Disable if on the last page
      >
        Next
        <ChevronRight />
      </Button>
    </div>
  );
}
