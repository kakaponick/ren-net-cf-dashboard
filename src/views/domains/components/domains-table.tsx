import { memo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { DomainRow } from './domain-row';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import type { SortField } from '../hooks/use-domains-sort';
import type { Zone } from '@/types/cloudflare';

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
		onRefreshDNS
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
				<Table>
						<TableHeader>
								<TableRow>
										<TableHead className="w-12">
												<Checkbox
														checked={allSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
														onCheckedChange={onToggleAll}
												/>
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
										<TableHead 
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSort('status')}
										>
												<div className="flex items-center space-x-2">
														<span>Status</span>
														{getSortIcon('status')}
												</div>
										</TableHead>
										<TableHead 
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSort('proxied')}
										>
												<div className="flex items-center space-x-2">
														<span>Proxied</span>
														{getSortIcon('proxied')}
												</div>
										</TableHead>
										<TableHead 
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSort('rootARecord')}
										>
												<div className="flex items-center space-x-2">
														<span>A Record</span>
														{getSortIcon('rootARecord')}
												</div>
										</TableHead>
										<TableHead 
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSort('account')}
										>
												<div className="flex items-center space-x-2">
														<span>Account</span>
														{getSortIcon('account')}
												</div>
										</TableHead>
										<TableHead 
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSort('created')}
										>
												<div className="flex items-center space-x-2">
														<span>Created</span>
														{getSortIcon('created')}
												</div>
										</TableHead>
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
														getStatusBadgeVariant={getStatusBadgeVariant}
												/>
										);
								})}
						</TableBody>
				</Table>
		);
});




