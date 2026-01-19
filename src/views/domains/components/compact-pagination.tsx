import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

	// Generate page numbers to show (max 5)
	const getPageNumbers = () => {
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
	};

	const pageNumbers = getPageNumbers();

	const maxDigits = Math.max(String(totalItems).length, 3);
	const formatNumber = (num: number) => String(num);

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1e1e1e] border-t border-[#3c3c3c]">
			<div className="mx-auto px-3 py-1.5">
				<div className="flex items-center justify-between gap-3 text-xs leading-tight whitespace-nowrap">
					<div className="flex items-center gap-2 font-mono text-[#d4d4d4] flex-shrink-0">
						<span className="text-[#858585]">[</span>
						<span className="text-[#d4d4d4] tabular-nums">
							{formatNumber(startIndex + 1)}-{formatNumber(endIndex)}
						</span>
						<span className="text-[#858585]">/</span>
						<span className="text-[#d4d4d4] tabular-nums">{formatNumber(totalItems)}</span>
						<span className="text-[#858585]">]</span>
						<span className="text-[#858585] mx-1">|</span>
						
						<Select value={rowsPerPageMode} onValueChange={onRowsPerPageChange}>
							<SelectTrigger className="h-5 w-[60px] px-2 py-0 text-xs font-mono focus:ring-0 focus:ring-offset-0 flex-shrink-0">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className=" ">
								<SelectItem value="fill" className="text-xs font-mono">Fill</SelectItem>
								<SelectItem value="50" className="text-xs font-mono">50</SelectItem>
								<SelectItem value="100" className="text-xs font-mono">100</SelectItem>
								<SelectItem value="all" className="text-xs font-mono">All</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{showPagination && (
						<div className="flex items-center gap-0.5 font-mono flex-shrink-0">
							<button
								onClick={() => onPageChange(currentPage - 1)}
								disabled={currentPage === 1}
								className={cn(
									"h-6 w-6 flex items-center justify-center rounded-sm",
									"text-[#858585] hover:text-[#d4d4d4] hover:bg-[#2d2d30]",
									"active:bg-[#1e1e1e] active:scale-95",
									"disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-[#858585] disabled:hover:bg-transparent",
									"transition-all duration-150 ease-out",
									"focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:ring-offset-1 focus:ring-offset-[#1e1e1e]",
									"flex-shrink-0"
								)}
								title="Previous page"
								aria-label="Previous page"
							>
								<ChevronLeft className="h-3.5 w-3.5" />
							</button>

							{pageNumbers.map((page, index) => {
								const showEllipsis = index > 0 && pageNumbers[index - 1] !== page - 1;
								const isActive = currentPage === page;

								return (
									<span key={page} className="inline-flex items-center flex-shrink-0">
										{showEllipsis && (
											<span className="px-1 text-[#858585] flex-shrink-0 select-none">...</span>
										)}
										<button
											onClick={() => onPageChange(page)}
											className={cn(
												"h-6 min-w-[32px] px-2.5 flex items-center justify-center text-xs rounded-sm",
												"transition-all duration-150 ease-out",
												"focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:ring-offset-1 focus:ring-offset-[#1e1e1e]",
												"flex-shrink-0",
												isActive
													? "text-[#ffffff] bg-[#007acc] hover:bg-[#005a9e] shadow-sm font-medium"
													: "text-[#858585] hover:text-[#d4d4d4] hover:bg-[#2d2d30] active:bg-[#1e1e1e] active:scale-95"
											)}
											aria-label={`Go to page ${page}`}
											aria-current={isActive ? "page" : undefined}
										>
											{page}
										</button>
									</span>
								);
							})}

							<button
								onClick={() => onPageChange(currentPage + 1)}
								disabled={currentPage === totalPages}
								className={cn(
									"h-6 w-6 flex items-center justify-center rounded-sm",
									"text-[#858585] hover:text-[#d4d4d4] hover:bg-[#2d2d30]",
									"active:bg-[#1e1e1e] active:scale-95",
									"disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-[#858585] disabled:hover:bg-transparent",
									"transition-all duration-150 ease-out",
									"focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:ring-offset-1 focus:ring-offset-[#1e1e1e]",
									"flex-shrink-0"
								)}
								title="Next page"
								aria-label="Next page"
							>
								<ChevronRight className="h-3.5 w-3.5" />
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
});