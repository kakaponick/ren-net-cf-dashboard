import { CheckCircle2, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BulkImportDialog } from './bulk-import-dialog';
import type { UnifiedDomain } from '@/types/registrar';

interface SelectionToolbarProps {
	selectedCount: number;
	selectedDomains: UnifiedDomain[];
	onCopySelected: () => void;
	onClearSelection: () => void;
}

export function SelectionToolbar({
	selectedCount,
	selectedDomains,
	onCopySelected,
	onClearSelection,
}: SelectionToolbarProps) {
	if (selectedCount === 0) return null;

	return (
		<Card className="sticky top-[60px] z-10 bg-primary/10 border-primary/30 shadow-lg backdrop-blur-sm transition-all duration-200 animate-in slide-in-from-top-2">
			<CardContent className="py-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3 flex-1 min-w-0">
						<div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 shrink-0">
							<CheckCircle2 className="h-4 w-4 text-primary" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 flex-wrap">
								<span className="text-sm font-semibold text-primary">
									{selectedCount} domain{selectedCount > 1 ? 's' : ''} selected
								</span>
								{selectedDomains.length > 0 && (
									<>
										<span className="text-xs text-muted-foreground hidden sm:inline">•</span>
										<div className="flex items-center gap-1.5 flex-wrap max-w-md">
											{selectedDomains.slice(0, 3).map((domain) => (
												<span
													key={domain.id}
													className="text-xs font-mono bg-background/80 px-2 py-0.5 rounded border border-border/50 truncate max-w-[120px]"
													title={domain.name}
												>
													{domain.name}
												</span>
											))}
											{selectedDomains.length > 3 && (
												<span className="text-xs text-muted-foreground">
													+{selectedDomains.length - 3} more
												</span>
											)}
										</div>
									</>
								)}
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						<Button size="sm" variant="outline" onClick={onCopySelected} className="gap-2">
							<Copy className="h-3.5 w-3.5" />
							Copy selected
						</Button>
						<BulkImportDialog selectedDomains={selectedDomains} onComplete={onClearSelection} />
						<Button size="sm" variant="outline" onClick={onClearSelection} className="gap-2">
							<X className="h-3.5 w-3.5" />
							Clear
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
