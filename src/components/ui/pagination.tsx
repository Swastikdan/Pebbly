import { Button } from "@/components/ui/button";
import {
	ChevronLeft,
	ChevronRight,
	MoreHorizontal,
} from "@/components/ui/icons";

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
			className="flex items-center justify-center gap-3 font-medium md:gap-1 py-4"
			aria-label="Pagination Navigation"
		>
			{/* Previous Button */}
			<Button
				variant="outline"
				className="rounded-lg border-border/60 pr-4 text-sm px-4"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 1}
				aria-label="Previous Page"
			>
				<ChevronLeft />
				<span>Prev</span>
			</Button>
			<div className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-secondary/60 px-3 py-1.5 md:hidden">
				<span className="font-medium text-sm text-foreground">Page</span>
				<div className="flex items-center gap-1.5">
					<span className="text-sm font-semibold" aria-current="page">
						{currentPage}
					</span>
					<span className="text-muted-foreground/50">/</span>
					<span className="text-sm text-muted-foreground">{totalPages}</span>
				</div>
			</div>
			<div className="hidden gap-1 px-1 md:flex">
				{/* Page 1 */}
				<Button
					variant={currentPage === 1 ? "secondary" : "ghost"}
					className="text-sm px-3 rounded-lg"
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
						variant="ghost"
						className="cursor-default text-sm px-2"
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
								variant={pageNumber === currentPage ? "secondary" : "ghost"}
								className="text-sm px-3 rounded-lg"
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
						variant="ghost"
						className="cursor-default text-sm px-2"
						disabled
						aria-hidden="true"
					>
						<MoreHorizontal />
					</Button>
				)}

				{/* Last Page */}
				{totalPages > 1 && (
					<Button
						variant={currentPage === totalPages ? "secondary" : "ghost"}
						className="text-sm px-3 rounded-lg"
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
				variant="outline"
				className="rounded-lg border-border/60 pl-4 text-sm px-4"
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
