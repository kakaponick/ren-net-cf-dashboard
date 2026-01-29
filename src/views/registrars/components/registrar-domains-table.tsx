import { memo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { UnifiedDomain } from '@/types/registrar';
import { ActivityBoundary } from '@/components/activity-boundary';
import { NameserversCell } from './nameservers-cell';

type SortField = 'name' | 'registrar' | 'expires' | 'status';

type RegistrarDomainsTableProps = {
	domains: UnifiedDomain[];
	sortField: SortField;
	sortDirection: 'asc' | 'desc';
	onSort: (field: SortField) => void;
	isSelected: (id: string) => boolean;
	onToggle: (id: string) => void;
	onToggleAll: () => void;
	allSelected: boolean;
	selectedCount: number;
	// Nameservers props
	nameserversCache: Record<string, { nameservers: string[], isUsingOurDNS: boolean }>;
	nameserversLoading: Record<string, boolean>;
	onRefreshNameservers: (domain: string) => void;
	onEditNameservers: (domain: UnifiedDomain) => void;
};

export const RegistrarDomainsTable = memo(function RegistrarDomainsTable({
	domains,
	sortField,
	sortDirection,
	onSort,
	isSelected,
	onToggle,
	onToggleAll,
	allSelected,
	selectedCount,
	nameserversCache,
	nameserversLoading,
	onRefreshNameservers,
	onEditNameservers,
}: RegistrarDomainsTableProps) {
	const getStatusTextColor = useCallback((status: string) => {
		if (status === 'expired') return 'text-destructive';
		if (status === 'locked' || status === 'inactive') return 'text-muted-foreground';
		return 'text-green-600';
	}, []);

	const getStatusText = useCallback((status: string) => {
		const statusMap: Record<string, string> = {
			active: 'Active',
			expired: 'Expired',
			locked: 'Locked',
			inactive: 'Inactive',
		};
		return statusMap[status] || status;
	}, []);

	const getWhoisGuardIcon = useCallback((domain: UnifiedDomain) => {
		// Namecheap domains have WhoisGuard info
		if (domain.ncDomain?.WhoisGuard) {
			switch (domain.ncDomain.WhoisGuard) {
				case 'ENABLED':
					return <ShieldCheck className="h-4 w-4" />;
				case 'NOTPRESENT':
					return <ShieldX className="h-4 w-4" />;
				default:
					return <Shield className="h-4 w-4" />;
			}
		}
		// Njalla doesn't have privacy info, return neutral icon
		return <Shield className="h-4 w-4 opacity-50" />;
	}, []);

	const formatDate = useCallback((dateString: string) => {
		try {
			// Try MM/DD/YYYY format first (Namecheap)
			if (dateString.includes('/')) {
				const [month, day, year] = dateString.split('/');
				const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
				return date.toLocaleDateString();
			}
			// Try ISO 8601 format (Njalla)
			const date = new Date(dateString);
			return date.toLocaleDateString();
		} catch {
			return dateString;
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
					<ActivityBoundary mode="visible">
						<TableHead className="text-center">Nameservers</TableHead>
					</ActivityBoundary>
					<ActivityBoundary mode="visible">
						<TableHead
							className="cursor-pointer hover:bg-muted/50"
							onClick={() => onSort('registrar')}
						>
							<div className="flex items-center space-x-2">
								<span>Registrar</span>
								{getSortIcon('registrar')}
							</div>
						</TableHead>
					</ActivityBoundary>
					<ActivityBoundary mode="visible">
						<TableHead
							className="cursor-pointer hover:bg-muted/50"
							onClick={() => onSort('status')}
						>
							<div className="flex items-center space-x-2">
								<span>Status</span>
								{getSortIcon('status')}
							</div>
						</TableHead>
					</ActivityBoundary>
					<ActivityBoundary mode="visible">
						<TableHead
							className="cursor-pointer hover:bg-muted/50"
							onClick={() => onSort('expires')}
						>
							<div className="flex items-center space-x-2">
								<span>Expires</span>
								{getSortIcon('expires')}
							</div>
						</TableHead>
					</ActivityBoundary>
					<TableHead className="text-center">Auto Renew</TableHead>
					<ActivityBoundary mode="visible">
						<TableHead className="text-center">Privacy</TableHead>
					</ActivityBoundary>
					<ActivityBoundary mode="visible">
						<TableHead className="text-center">Premium</TableHead>
					</ActivityBoundary>
					<ActivityBoundary mode="visible">
						<TableHead className="text-center">DNS</TableHead>
					</ActivityBoundary>

				</TableRow>
			</TableHeader>
			<TableBody>
				{domains.map((domain) => {
					const rowId = domain.id;
					return (
						<TableRow key={rowId}>
							<TableCell>
								<label className="flex items-center justify-center p-2 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer">
									<Checkbox
										checked={isSelected(rowId)}
										onCheckedChange={() => onToggle(rowId)}
									/>
								</label>
							</TableCell>
							<TableCell className="font-medium">
								{domain.name}
							</TableCell>
							<TableCell className="text-center">
								<NameserversCell
									domain={domain}
									nameservers={nameserversCache[domain.name]?.nameservers || null}
									isUsingOurDNS={nameserversCache[domain.name]?.isUsingOurDNS ?? null}
									isLoading={nameserversLoading[domain.name] || false}
									onRefresh={onRefreshNameservers}
									onEdit={onEditNameservers}
								/>
							</TableCell>
							<TableCell className="capitalize">
								<span className="px-2 py-1 bg-muted/50 rounded text-xs font-medium">
									{domain.registrar}
								</span>
							</TableCell>
							<TableCell>
								<span className={getStatusTextColor(domain.status)}>
									{getStatusText(domain.status)}
								</span>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatDate(domain.expiry)}
							</TableCell>
							<TableCell className="text-center">
								{domain.autorenew ? 'Yes' : 'No'}
							</TableCell>
							<TableCell className="text-center">
								<div className="flex justify-center">
									{getWhoisGuardIcon(domain)}
								</div>
							</TableCell>
							<TableCell className="text-center">
								{domain.ncDomain?.IsPremium ? 'Premium' : domain.ncDomain ? 'Standard' : '—'}
							</TableCell>
							<TableCell className="text-center">
								{domain.ncDomain?.IsOurDNS ? 'Namecheap' : domain.ncDomain ? 'External' : '—'}
							</TableCell>

						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
});