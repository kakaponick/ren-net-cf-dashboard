import { memo, useCallback, useMemo, useState } from 'react';
import { ExternalLink, Settings, RefreshCw, Info, ChevronDown, MoreVertical, Trash2, Globe, Loader2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CopyButton } from '@/components/ui/copy-button';
import { cn, getRootARecordsFromDNS } from '@/lib/utils';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ARecordsCell, ProxiedCell } from './dns-cell';
import { DNSDrawer } from '@/components/dns-drawer';
import { useAccountStore } from '@/store/account-store';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import { useDomainHealth } from '@/hooks/use-domain-health';
import { DomainHealthCell } from './domain-health';
import { DomainExpirationCell } from './domain-expiration';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import type { DNSRecord, Zone } from '@/types/cloudflare';
import type { DomainColumnVisibility } from '../domain-columns';
import { ActivityBoundary } from '@/components/activity-boundary';

type DomainRowProps = {
	item: ZoneWithDNS;
	rowId: string;
	isSelected: boolean;
	onToggle: (rowId: string) => void;
	onRefreshDNS?: (zoneId: string, accountId: string) => void;
	onDomainDeleted?: (zoneId: string, accountId: string) => void;
	getStatusBadgeVariant: (status: Zone['status']) => 'default' | 'secondary' | 'outline' | 'destructive';
	visibleColumns: DomainColumnVisibility;
};

export const DomainRow = memo(function DomainRow({
	item,
	rowId,
	isSelected,
	onToggle,
	onRefreshDNS,
	onDomainDeleted,
	getStatusBadgeVariant,
	visibleColumns
}: DomainRowProps) {
	const { getDomainNameservers, accounts } = useAccountStore();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isCreatingCNAME, setIsCreatingCNAME] = useState(false);
	const { health, error: healthError, isChecking, checkHealth } = useDomainHealth(item.zone.name);
	
	const handleToggle = useCallback(() => onToggle(rowId), [onToggle, rowId]);
	const handleRefreshDNS = useCallback(() => onRefreshDNS?.(item.zone.id, item.accountId), [onRefreshDNS, item.zone.id, item.accountId]);
	
	const handleDelete = useCallback(async () => {
		setIsDeleting(true);
		try {
			const account = accounts.find(acc => acc.id === item.accountId);
			if (!account) {
				toast.error('Account not found');
				return;
			}

			const api = new CloudflareAPI(account.apiToken);
			await api.deleteZone(item.zone.id);
			toast.success(`Domain "${item.zone.name}" deleted successfully`);
			setIsDeleteDialogOpen(false);
			onDomainDeleted?.(item.zone.id, item.accountId);
		} catch (error) {
			console.error('Error deleting domain:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to delete domain';
			toast.error(errorMessage);
		} finally {
			setIsDeleting(false);
		}
	}, [item.zone.id, item.zone.name, item.accountId, accounts, onDomainDeleted]);

	const handleCreateWWWCNAME = useCallback(async () => {
		const account = accounts.find(acc => acc.id === item.accountId);
		if (!account) {
			toast.error('Account not found');
			return;
		}

		setIsCreatingCNAME(true);
		const loadingToast = toast.loading('Creating www CNAME record...', {
			description: `Domain: ${item.zone.name}`,
		});

		try {
			const api = new CloudflareAPI(account.apiToken);
			
			// Check if www CNAME already exists
			const dnsRecords: DNSRecord[] = await api.getDNSRecords(item.zone.id);
			const existingWWWCNAME = dnsRecords.find(
				(record: DNSRecord) => record.type === 'CNAME' && record.name === 'www'
			);

			if (existingWWWCNAME) {
				toast.dismiss(loadingToast);
				toast.info('www CNAME record already exists', {
					description: `Domain: ${item.zone.name}`,
				});
				setIsCreatingCNAME(false);
				return;
			}

			// Determine proxied status from current root A record if it exists
			const rootARecord =
				getRootARecordsFromDNS(dnsRecords, item.zone.name)[0] ?? item.rootARecords?.[0];
			const proxied = rootARecord?.proxied ?? false;

			// Create www CNAME record
			await api.createDNSRecord(item.zone.id, {
				type: 'CNAME',
				name: 'www',
				content: '@',
				ttl: 1,
				proxied: proxied,
			});

			toast.dismiss(loadingToast);
			toast.success('www CNAME record created successfully', {
				description: `Domain: ${item.zone.name}`,
			});
			handleRefreshDNS();
		} catch (error) {
			console.error('Error creating www CNAME record:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to create www CNAME record';
			toast.dismiss(loadingToast);
			toast.error(errorMessage, {
				description: `Domain: ${item.zone.name}`,
			});
		} finally {
			setIsCreatingCNAME(false);
		}
	}, [item.zone.id, item.zone.name, item.accountId, item.rootARecords, accounts, handleRefreshDNS]);

	// Get nameservers from zone or store
	const nameservers = useMemo(() => {
		if (item.zone.name_servers && Array.isArray(item.zone.name_servers) && item.zone.name_servers.length > 0) {
			return item.zone.name_servers;
		}
		return getDomainNameservers(item.zone.name) || [];
	}, [item.zone.name_servers, item.zone.name, getDomainNameservers]);

	const isPending = item.zone.status === 'pending';
	const hasNameservers = nameservers.length > 0;

	return (
		<TableRow 
			data-state={isSelected ? 'selected' : undefined}
			className={cn(
				"transition-colors",
				isSelected && "bg-muted/30"
			)}
		>
			<TableCell className="w-14">
				<label className="flex items-center justify-center p-2 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer">
					<Checkbox 
						checked={isSelected} 
						onCheckedChange={handleToggle}
					/>
				</label>
			</TableCell>

			<TableCell className="font-medium">

				<div className="flex gap-2">
					<div className="flex items-center gap-1 mr-2">
						<Button
							asChild
							variant="ghost"
							className="h-8 w-8"
							title={`Open ${item.zone.name} in new tab`}
						>
							<a
								href={`https://${item.zone.name}`}
								target="_blank"
								rel="noopener noreferrer"
							>

								<ExternalLink className="h-3 w-3 opacity-50" />
							</a>
						</Button>
						<CopyButton
							text={item.zone.name}
							successMessage={`Copied ${item.zone.name} to clipboard`}
							errorMessage="Failed to copy domain name"
							size="icon"
							className="h-8 w-8"
							title="Copy domain name"
							copyIconClassName="h-4 w-4"
							checkIconClassName="h-4 w-4"
						/>
					</div>

					<div className="flex flex-col">
						<span className="font-semibold">
							{item.zone.name}
						</span>
						{item.dnsLoading ? (
							<Skeleton className="h-3 w-24 mt-1" />
						) : (
							<span className="text-xs text-muted-foreground">
								{item.dnsRecords?.length || 0} dns records
							</span>
						)}

					</div>
				</div>
			</TableCell>

			<ActivityBoundary mode={visibleColumns.status ? 'visible' : 'hidden'}>
				<TableCell>
					{item.dnsLoading ? (
						<Skeleton className="h-6 w-12" />
					) : isPending && hasNameservers ? (
						<Popover>
							<PopoverTrigger asChild>
								<button className="inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm">
									<Badge variant={getStatusBadgeVariant(item.zone.status)} className="inline-flex items-center gap-1.5">
										{item.zone.status}
										<Info className="h-3 w-3" />
									</Badge>
								</button>
							</PopoverTrigger>
							<PopoverContent className="w-80" align="start">
								<div className="space-y-3">
									<div>
										<h4 className="font-medium text-sm mb-2">Cloudflare Nameservers</h4>
										<p className="text-xs text-muted-foreground mb-3">
											Replace your current nameservers with these Cloudflare nameservers:
										</p>
									</div>
									<div className="space-y-2">
										{nameservers.map((nameserver, index) => (
											<NameserverItem key={index} nameserver={nameserver} />
										))}
									</div>
								</div>
							</PopoverContent>
						</Popover>
					) : (
						<Badge variant={getStatusBadgeVariant(item.zone.status)}>
							{item.zone.status}
						</Badge>
					)}
				</TableCell>
			</ActivityBoundary>
			<ActivityBoundary mode={visibleColumns.proxied ? 'visible' : 'hidden'}>
				<TableCell>
					<ProxiedCell rootARecords={item.rootARecords} isLoading={item.dnsLoading} />
				</TableCell>
			</ActivityBoundary>
			<ActivityBoundary mode={visibleColumns.rootARecord ? 'visible' : 'hidden'}>
				<TableCell>
					<ARecordsCell 
						rootARecords={item.rootARecords} 
						isLoading={item.dnsLoading}
						zoneId={item.zone.id}
						accountId={item.accountId}
						zoneName={item.zone.name}
						onRefreshDNS={onRefreshDNS}
					/>
				</TableCell>
			</ActivityBoundary>
			<ActivityBoundary mode={visibleColumns.expiration ? 'visible' : 'hidden'}>
				<TableCell>
					<DomainExpirationCell
						domain={item.zone.name}
						health={health}
						error={healthError}
						isLoading={isChecking}
						onRefresh={checkHealth}
					/>
				</TableCell>
			</ActivityBoundary>
			<ActivityBoundary mode={visibleColumns.health ? 'visible' : 'hidden'}>
				<TableCell>
					<DomainHealthCell
						domain={item.zone.name}
						health={health}
						error={healthError}
						isLoading={isChecking}
						onCheck={checkHealth}
					/>
				</TableCell>
			</ActivityBoundary>
			<ActivityBoundary mode={visibleColumns.account ? 'visible' : 'hidden'}>
				<TableCell>
					<span className="text-sm">{item.accountEmail}</span>
				</TableCell>
			</ActivityBoundary>
			<ActivityBoundary mode={visibleColumns.created ? 'visible' : 'hidden'}>
				<TableCell>
					<span className="text-sm text-muted-foreground">
						{new Date(item.zone.created_on).toLocaleDateString()}
					</span>
				</TableCell>
			</ActivityBoundary>
			<TableCell className="text-right">
				<div className="flex items-center justify-end space-x-2">
					<Button
						size="icon"
						variant="ghost"
						className="h-8 w-8"
						onClick={handleRefreshDNS}
						disabled={item.dnsLoading}
						title="Refresh DNS records"
					>
						<RefreshCw className={`h-4 w-4 ${item.dnsLoading ? 'animate-spin' : ''}`} />
					</Button>
					<DNSDrawer
						zoneId={item.zone.id}
						accountId={item.accountId}
						zoneName={item.zone.name}
						trigger={
							<Button size="sm" variant="outline">
								<Settings className="mr-1 h-3 w-3" />
								DNS
							</Button>
						}
					/>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="icon"
								variant="ghost"
								className="h-8 w-8"
								title="More options"
							>
								<MoreVertical className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() => { void checkHealth(true); }}
									disabled={isChecking}
									className="cursor-pointer"
								>
									{isChecking ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<RefreshCw className="mr-2 h-4 w-4" />
									)}
									Check health
								</DropdownMenuItem>
							<DropdownMenuItem
								onClick={handleCreateWWWCNAME}
								disabled={isCreatingCNAME}
								className={cn(
									"cursor-pointer",
									isCreatingCNAME && "opacity-50 cursor-not-allowed"
								)}
							>
								{isCreatingCNAME ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Globe className="mr-2 h-4 w-4" />
								)}
								{isCreatingCNAME ? 'Creating www CNAME...' : 'Create www CNAME'}
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive"
								onClick={() => setIsDeleteDialogOpen(true)}
								disabled={isCreatingCNAME}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete Domain 
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete Domain</AlertDialogTitle>
								<AlertDialogDescription>
									Are you sure you want to delete <strong>{item.zone.name}</strong>? This action cannot be undone and will remove all DNS records and settings for this domain.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
								<AlertDialogAction
									onClick={handleDelete}
									disabled={isDeleting}
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								>
									{isDeleting ? 'Deleting...' : 'Delete'}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</TableCell>
		</TableRow>
	);
});

type NameserverItemProps = {
	nameserver: string;
};

const NameserverItem = memo(function NameserverItem({ nameserver }: NameserverItemProps) {
	return (
		<div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 border">
			<code className="text-xs font-mono flex-1">{nameserver}</code>
			<CopyButton
				text={nameserver}
				successMessage={`Copied ${nameserver} to clipboard`}
				errorMessage="Failed to copy nameserver"
				size="sm"
				className="h-7 w-7 p-0"
				title="Copy nameserver"
				copyIconClassName="h-3 w-3"
				checkIconClassName="h-3 w-3"
			/>
		</div>
	);
});




