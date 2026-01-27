import { memo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { DomainRow } from './domain-row';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import type { SortField } from '../hooks/use-domains-sort';
import type { Zone } from '@/types/cloudflare';
import { DOMAIN_COLUMN_LABELS, type DomainColumnVisibility } from '../domain-columns';
import { ActivityBoundary } from '@/components/activity-boundary';

type DomainsTableProps = {
		zones: ZoneWithDNS[];
		sortField: SortField;
		sortDirection: 'asc' | 'desc';
		onSort: (field: SortField) => void;
		isSelected: (id: string) => boolean;
		onToggle: (id: string) => void;
		onToggleAll: () => void;
		allSelected: boolean;
		selectedCount: number;
		onRefreshDNS?: (zoneId: string, accountId: string) => void;
		onDomainDeleted?: (zoneId: string, accountId: string) => void;
		visibleColumns: DomainColumnVisibility;
};

export const DomainsTable = memo(function DomainsTable({
		zones,
		sortField,
		sortDirection,
		onSort,
		isSelected,
		onToggle,
		onToggleAll,
		allSelected,
		selectedCount,
		onRefreshDNS,
		onDomainDeleted,
		visibleColumns
}: DomainsTableProps) {
		const getStatusBadgeVariant = useCallback((status: Zone['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
				switch (status) {
						case 'active':
								return 'default';
						case 'pending':
								return 'secondary';
						case 'initializing':
								return 'outline';
						default:
								return 'secondary';
				}
		}, []);

		const getSortIcon = (field: SortField) => {
				if (sortField !== field) {
						return <ArrowUpDown className="h-4 w-4" />;
				}
				return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
		};

		return (
				<Table className='mb-2'>
						<TableHeader>
								<TableRow>
										<TableHead className="w-14">
												<label className="flex items-center justify-center p-2 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer">
													<Checkbox
														checked={allSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
														onCheckedChange={onToggleAll}
													/>
												</label>
										</TableHead>
										<TableHead
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSort('name')}
										>
												<div className="flex items-center space-x-2">
														<span>Domain</span>
														{getSortIcon('name')}
												</div>
										</TableHead>
										<ActivityBoundary mode={visibleColumns.status ? 'visible' : 'hidden'}>
												<TableHead
														className="cursor-pointer hover:bg-muted/50"
														onClick={() => onSort('status')}
												>
														<div className="flex items-center space-x-2">
																<span>{DOMAIN_COLUMN_LABELS.status}</span>
																{getSortIcon('status')}
														</div>
												</TableHead>
										</ActivityBoundary>
										<ActivityBoundary mode={visibleColumns.proxied ? 'visible' : 'hidden'}>
												<TableHead
														className="cursor-pointer hover:bg-muted/50"
														onClick={() => onSort('proxied')}
												>
														<div className="flex items-center space-x-2">
																<span>{DOMAIN_COLUMN_LABELS.proxied}</span>
																{getSortIcon('proxied')}
														</div>
												</TableHead>
										</ActivityBoundary>
										<ActivityBoundary mode={visibleColumns.rootARecord ? 'visible' : 'hidden'}>
												<TableHead
														className="cursor-pointer hover:bg-muted/50"
														onClick={() => onSort('rootARecord')}
												>
														<div className="flex items-center space-x-2">
																<span>{DOMAIN_COLUMN_LABELS.rootARecord}</span>
																{getSortIcon('rootARecord')}
														</div>
												</TableHead>
										</ActivityBoundary>
										<ActivityBoundary mode={visibleColumns.sslTls ? 'visible' : 'hidden'}>
												<TableHead
														className="cursor-pointer hover:bg-muted/50"
														onClick={() => onSort('sslTls')}
												>
														<div className="flex items-center space-x-2">
																<span>{DOMAIN_COLUMN_LABELS.sslTls}</span>
																{getSortIcon('sslTls')}
														</div>
												</TableHead>
										</ActivityBoundary>
										<ActivityBoundary mode={visibleColumns.account ? 'visible' : 'hidden'}>
												<TableHead
														className="cursor-pointer hover:bg-muted/50"
														onClick={() => onSort('account')}
												>
														<div className="flex items-center space-x-2">
																<span>{DOMAIN_COLUMN_LABELS.account}</span>
																{getSortIcon('account')}
														</div>
												</TableHead>
										</ActivityBoundary>
										<ActivityBoundary mode={visibleColumns.created ? 'visible' : 'hidden'}>
												<TableHead
														className="cursor-pointer hover:bg-muted/50"
														onClick={() => onSort('created')}
												>
														<div className="flex items-center space-x-2">
																<span>{DOMAIN_COLUMN_LABELS.created}</span>
																{getSortIcon('created')}
														</div>
												</TableHead>
										</ActivityBoundary>
										<TableHead className="text-right">Actions</TableHead>
								</TableRow>
						</TableHeader>
						<TableBody>
								{zones.map((item) => {
										const rowId = `${item.accountId}-${item.zone.id}`;
										return (
												<DomainRow
														key={rowId}
														item={item}
														rowId={rowId}
														isSelected={isSelected(rowId)}
														onToggle={onToggle}
														onRefreshDNS={onRefreshDNS}
														onDomainDeleted={onDomainDeleted}
														getStatusBadgeVariant={getStatusBadgeVariant}
														visibleColumns={visibleColumns}
												/>
										);
								})}
						</TableBody>
				</Table>
		);
});




