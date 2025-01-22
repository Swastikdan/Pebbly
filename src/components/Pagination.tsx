'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

/**
 * Pagination component for displaying page numbers and navigation controls.
 * @param currentPage - The currently active page number.
 * @param totalPages - The total number of pages available.
 * @param onPageChange - Callback function to handle page changes.  Accepts the new page number as an argument.
 */
interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
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
  if (totalPages <= 1) return null //Return null if there's only one page or less

  return (
    <div className="flex items-center justify-center gap-5 font-medium md:gap-1">
      {/* Previous Button */}
      <Button
        variant="ghost"
        className="border border-input px-2 pr-4 text-lg md:border-transparent md:text-base"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1} //Disable if on the first page
      >
        <ChevronLeft />

        <span>Prev</span>
      </Button>
      <div className="flex h-9 items-center justify-center gap-2 rounded-lg bg-secondary/20 px-4 py-2 md:hidden">
        <span className="text-base font-medium text-primary">Page</span>
        <div className="flex items-center gap-2">
          <span className="text-base" aria-current="page">
            {currentPage}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-base text-muted-foreground">{totalPages}</span>
        </div>
      </div>
      <div className="hidden md:block">
        {/* Page 1 */}
        <Button
          variant={currentPage === 1 ? 'secondary' : 'ghost'} //Highlight if on page 1
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
          const pageNumber = currentPage - 2 + i
          if (pageNumber > 1 && pageNumber < totalPages) {
            return (
              <Button
                key={pageNumber}
                variant={pageNumber === currentPage ? 'secondary' : 'ghost'} //Highlight current page
                className="text-base"
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </Button>
            )
          }
          return null
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
            variant={currentPage === totalPages ? 'secondary' : 'ghost'} //Highlight if on last page
            className="text-base"
            onClick={() => onPageChange(totalPages)}
          >
            {totalPages}
          </Button>
        )}
      </div>
      {/* Next Button */}
      <Button
        variant="ghost"
        className="border border-input px-2 pl-4 text-lg md:border-transparent md:text-base"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages} //Disable if on the last page
      >
        Next
        <ChevronRight />
      </Button>
    </div>
  )
}
