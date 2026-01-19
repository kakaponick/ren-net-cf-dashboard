import { memo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { NamecheapDomain } from '@/types/namecheap';
import { ActivityBoundary } from '@/components/activity-boundary';

type SortField = 'name' | 'user' | 'created' | 'expires' | 'status';

type RegistrarDomainsTableProps = {
	domains: NamecheapDomain[];
	sortField: SortField;
	sortDirection: 'asc' | 'desc';
	onSort: (field: SortField) => void;
	isSelected: (id: string) => boolean;
	onToggle: (id: string) => void;
	onToggleAll: () => void;
	allSelected: boolean;
	selectedCount: number;
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
	selectedCount
}: RegistrarDomainsTableProps) {
	const getStatusTextColor = useCallback((isExpired: boolean, isLocked: boolean) => {
		if (isExpired) return 'text-destructive';
		if (isLocked) return 'text-muted-foreground';
		return 'text-green-600';
	}, []);


	const getStatusText = useCallback((domain: NamecheapDomain) => {
		if (domain.IsExpired) return 'Expired';
		if (domain.IsLocked) return 'Locked';
		return 'Active';
	}, []);

	const getWhoisGuardIcon = useCallback((whoisGuard: string) => {
		switch (whoisGuard) {
			case 'ENABLED':
				return <ShieldCheck className="h-4 w-4" />;
			case 'NOTPRESENT':
				return <ShieldX className="h-4 w-4" />;
			default:
				return <Shield className="h-4 w-4" />;
		}
	}, []);

	const formatDate = useCallback((dateString: string) => {
		try {
			// Parse MM/DD/YYYY format
			const [month, day, year] = dateString.split('/');
			const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
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
							onClick={() => onSort('user')}
						>
							<div className="flex items-center space-x-2">
								<span>User</span>
								{getSortIcon('user')}
							</div>
						</TableHead>
					</ActivityBoundary>
					<ActivityBoundary mode="visible">
						<TableHead
							className="cursor-pointer hover:bg-muted/50"
							onClick={() => onSort('created')}
						>
							<div className="flex items-center space-x-2">
								<span>Created</span>
								{getSortIcon('created')}
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
					<TableHead className="text-center">Privacy</TableHead>
					<TableHead className="text-center">Auto Renew</TableHead>
					<TableHead className="text-center">Premium</TableHead>
					<TableHead className="text-center">DNS</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{domains.map((domain) => {
					const rowId = domain.ID.toString();
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
								{domain.Name}
							</TableCell>
							<TableCell>
								<span className={getStatusTextColor(domain.IsExpired, domain.IsLocked)}>
									{getStatusText(domain)}
								</span>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{domain.User}
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatDate(domain.Created)}
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatDate(domain.Expires)}
							</TableCell>
							<TableCell className="text-center">
								<div className="flex justify-center">
									{getWhoisGuardIcon(domain.WhoisGuard)}
								</div>
							</TableCell>
							<TableCell className="text-center">
								{domain.AutoRenew ? 'Yes' : 'No'}
							</TableCell>
							<TableCell className="text-center">
								{domain.IsPremium ? 'Premium' : 'Standard'}
							</TableCell>
							<TableCell className="text-center">
								{domain.IsOurDNS ? 'Namecheap' : 'External'}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
});