import { memo, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CompactPaginationProps = {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
	rowsPerPageMode: 'fill' | '50' | '100' | 'all';
	onPageChange: (page: number) => void;
	onRowsPerPageChange: (mode: 'fill' | '50' | '100' | 'all') => void;
};



export const CompactPagination = memo(function CompactPagination({
	currentPage,
	totalPages,
	totalItems,
	itemsPerPage,
	rowsPerPageMode,
	onPageChange,
	onRowsPerPageChange,
}: CompactPaginationProps) {
	const startIndex = rowsPerPageMode === 'all' ? 0 : (currentPage - 1) * itemsPerPage;
	const endIndex = rowsPerPageMode === 'all' ? totalItems : Math.min(startIndex + itemsPerPage, totalItems);
	const showPagination = totalPages > 1;


	// Use refs to avoid recreating event handler on every page change
	const pageStateRef = useRef({ currentPage, totalPages, showPagination, onPageChange });
	pageStateRef.current = { currentPage, totalPages, showPagination, onPageChange };

	// Keyboard navigation - stable reference
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const { currentPage, totalPages, showPagination, onPageChange } = pageStateRef.current;
			if (!showPagination) return;
			// Ignore if user is typing in an input
			if (e.target instanceof HTMLTextAreaElement) return;

			if (e.key === 'ArrowLeft' && currentPage > 1) {
				e.preventDefault();
				onPageChange(currentPage - 1);
			} else if (e.key === 'ArrowRight' && currentPage < totalPages) {
				e.preventDefault();
				onPageChange(currentPage + 1);
			} else if (e.key === 'Home' && currentPage > 1) {
				e.preventDefault();
				onPageChange(1);
			} else if (e.key === 'End' && currentPage < totalPages) {
				e.preventDefault();
				onPageChange(totalPages);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []); // Empty deps - handler uses ref

	// Memoize page numbers calculation
	const pageNumbers = useMemo(() => {
		const pages: number[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			if (currentPage <= 3) {
				for (let i = 1; i <= 4; i++) {
					pages.push(i);
				}
				pages.push(totalPages);
			} else if (currentPage >= totalPages - 2) {
				pages.push(1);
				for (let i = totalPages - 3; i <= totalPages; i++) {
					pages.push(i);
				}
			} else {
				pages.push(1);
				for (let i = currentPage - 1; i <= currentPage + 1; i++) {
					pages.push(i);
				}
				pages.push(totalPages);
			}
		}

		return pages;
	}, [currentPage, totalPages]);

	const formatNumber = useCallback((num: number) => num.toLocaleString(), [])

	// Stable navigation handlers
	const goToFirst = useCallback(() => onPageChange(1), [onPageChange]);
	const goToPrev = useCallback(() => onPageChange(currentPage - 1), [currentPage, onPageChange]);
	const goToNext = useCallback(() => onPageChange(currentPage + 1), [currentPage, onPageChange]);
	const goToLast = useCallback(() => onPageChange(totalPages), [totalPages, onPageChange]);

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border shadow-sm supports-[backdrop-filter]:bg-background/60">
			<div className="mx-auto px-4 py-2">
				<div className="flex items-center justify-between gap-4 text-xs">
					{/* Left section: Item count & rows per page */}
					<div className="flex items-center gap-4 text-muted-foreground">
						<div className="flex items-center gap-2 tabular-nums">
							<span className="text-foreground font-medium">{formatNumber(startIndex + 1)}</span>
							<span>-</span>
							<span className="text-foreground font-medium">{formatNumber(endIndex)}</span>
							<span>of</span>
							<span className="text-foreground font-medium">{formatNumber(totalItems)}</span>
						</div>

						<div className="h-4 w-[1px] bg-border" />

						<div className="flex items-center gap-2">
							<span className="hidden sm:inline">Rows per page</span>
							<Select value={rowsPerPageMode} onValueChange={onRowsPerPageChange}>
								<SelectTrigger className="h-6 w-[70px] px-2 text-xs border-transparent bg-secondary/50 hover:bg-secondary focus:ring-0 focus:ring-offset-0">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="fill" className="text-xs">Fill</SelectItem>
									<SelectItem value="50" className="text-xs">50</SelectItem>
									<SelectItem value="100" className="text-xs">100</SelectItem>
									<SelectItem value="all" className="text-xs">All</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Right section: Pagination controls */}
					{showPagination && (
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									onClick={goToFirst}
									disabled={currentPage === 1}
									title="First page"
								>
									<ChevronsLeft className="h-3.5 w-3.5" />
									<span className="sr-only">First page</span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									onClick={goToPrev}
									disabled={currentPage === 1}
									title="Previous page"
								>
									<ChevronLeft className="h-3.5 w-3.5" />
									<span className="sr-only">Previous page</span>
								</Button>
							</div>

							<div className="flex items-center gap-1 bg-secondary/30 rounded-md px-1 py-0.5">
								{pageNumbers.map((page, index) => {
									const showEllipsis = index > 0 && pageNumbers[index - 1] !== page - 1;
									return (
										<div key={page} className="flex items-center">
											{showEllipsis && (
												<span className="px-2 text-muted-foreground text-[10px] select-none">...</span>
											)}
											<Button
												variant={currentPage === page ? "secondary" : "ghost"}
												size="sm"
												className={cn(
													"h-6 min-w-[24px] px-1.5 text-xs font-normal",
													currentPage === page
														? "bg-background shadow-sm hover:bg-background cursor-default"
														: "hover:bg-background/50",
													"transition-all duration-200"
												)}
												onClick={() => onPageChange(page)}
											>
												{page}
											</Button>
										</div>
									);
								})}
							</div>

							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									onClick={goToNext}
									disabled={currentPage === totalPages}
									title="Next page"
								>
									<ChevronRight className="h-3.5 w-3.5" />
									<span className="sr-only">Next page</span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									onClick={goToLast}
									disabled={currentPage === totalPages}
									title="Last page"
								>
									<ChevronsRight className="h-3.5 w-3.5" />
									<span className="sr-only">Last page</span>
								</Button>
							</div>


						</div>
					)}
				</div>
			</div>
		</div>
	);
});