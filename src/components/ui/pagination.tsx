import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "@/components/ui/icons";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className="flex items-center justify-center gap-3 py-4 font-medium md:gap-1"
      aria-label="Pagination Navigation"
    >
      <Button
        variant="outline"
        className="border-border/60 rounded-lg px-4 pr-4 text-sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous Page"
      >
        <ChevronLeft />
        <span>Prev</span>
      </Button>
      <div className="bg-secondary/60 flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 md:hidden">
        <span className="text-foreground text-sm font-medium">Page</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold" aria-current="page">
            {currentPage}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-muted-foreground text-sm">{totalPages}</span>
        </div>
      </div>
      <div className="hidden gap-1 px-1 md:flex">
        <Button
          variant={currentPage === 1 ? "secondary" : "ghost"}
          className="rounded-lg px-3 text-sm"
          onClick={() => onPageChange(1)}
          aria-label="Page 1"
          size="icon"
          aria-current={currentPage === 1 ? "page" : undefined}
        >
          1
        </Button>

        {currentPage > 4 && (
          <Button
            variant="ghost"
            className="cursor-default px-2 text-sm"
            disabled
            aria-hidden="true"
          >
            <MoreHorizontal />
          </Button>
        )}

        {Array.from({ length: 5 }, (_, i) => {
          const pageNumber = currentPage - 2 + i;
          if (pageNumber > 1 && pageNumber < totalPages) {
            return (
              <Button
                key={pageNumber}
                variant={pageNumber === currentPage ? "secondary" : "ghost"}
                className="rounded-lg px-3 text-sm"
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

        {currentPage < totalPages - 3 && (
          <Button
            variant="ghost"
            className="cursor-default px-2 text-sm"
            disabled
            aria-hidden="true"
          >
            <MoreHorizontal />
          </Button>
        )}

        {totalPages > 1 && (
          <Button
            variant={currentPage === totalPages ? "secondary" : "ghost"}
            className="rounded-lg px-3 text-sm"
            onClick={() => onPageChange(totalPages)}
            aria-label={`Page ${totalPages}`}
            size="icon"
            aria-current={currentPage === totalPages ? "page" : undefined}
          >
            {totalPages}
          </Button>
        )}
      </div>
      <Button
        variant="outline"
        className="border-border/60 rounded-lg px-4 pl-4 text-sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next Page"
      >
        Next
        <ChevronRight />
      </Button>
    </nav>
  );
}
