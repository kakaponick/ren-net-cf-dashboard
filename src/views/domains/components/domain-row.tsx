import { memo, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Settings, RefreshCw, Copy, Check, Info, ChevronDown, MoreVertical, Trash2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { copyToClipboard } from '@/lib/utils';
import { useAccountStore } from '@/store/account-store';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import type { Zone } from '@/types/cloudflare';

type DomainRowProps = {
	item: ZoneWithDNS;
	rowId: string;
	isSelected: boolean;
	onToggle: (rowId: string) => void;
	onRefreshDNS?: (zoneId: string, accountId: string) => void;
	onDomainDeleted?: () => void;
	getStatusBadgeVariant: (status: Zone['status']) => 'default' | 'secondary' | 'outline' | 'destructive';
};

export const DomainRow = memo(function DomainRow({ item, rowId, isSelected, onToggle, onRefreshDNS, onDomainDeleted, getStatusBadgeVariant }: DomainRowProps) {
	const { getDomainNameservers, accounts } = useAccountStore();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	
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
			onDomainDeleted?.();
		} catch (error) {
			console.error('Error deleting domain:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to delete domain';
			toast.error(errorMessage);
		} finally {
			setIsDeleting(false);
		}
	}, [item.zone.id, item.zone.name, item.accountId, accounts, onDomainDeleted]);

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
		<TableRow>

			<TableCell>
				<Checkbox checked={isSelected} onCheckedChange={handleToggle} />
			</TableCell>

			<TableCell className="font-medium">

				<div className="flex gap-2">
					<div className="flex flex-col">
						<span className="font-semibold">
							{item.zone.name}
						</span>
						{item.dnsLoading ? (
							<Skeleton className="h-3 w-24 mt-1" />
						) : (
							<span className="text-xs text-muted-foreground">
								{item.zone.name_servers?.length || 0} name servers
							</span>
						)}

					</div>

					<div className="flex items-center gap-1">
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
						<Button
							size="icon"
							variant="ghost"
							className="h-8 w-8"
							title="Copy domain name"
							onClick={() => copyToClipboard(item.zone.name, `Copied ${item.zone.name} to clipboard`, 'Failed to copy domain name')}
						>
							<Copy className="h-4 w-4 opacity-50" />
						</Button>
					</div>



				</div>
			</TableCell>

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
			<TableCell>
				<ProxiedCell rootARecords={item.rootARecords} isLoading={item.dnsLoading} />
			</TableCell>
			<TableCell>
				<ARecordsCell rootARecords={item.rootARecords} isLoading={item.dnsLoading} />
			</TableCell>
			<TableCell>
				<span className="text-sm">{item.accountEmail}</span>
			</TableCell>
			<TableCell>
				<span className="text-sm text-muted-foreground">
					{new Date(item.zone.created_on).toLocaleDateString()}
				</span>
			</TableCell>
			<TableCell className="text-right">
				<div className="flex items-center justify-end space-x-2">
					<Button
						size="icon"
						variant="ghost"
						onClick={handleRefreshDNS}
						disabled={item.dnsLoading}
						title="Refresh DNS records"
					>
						<RefreshCw className={`h-4 w-4 ${item.dnsLoading ? 'animate-spin' : ''}`} />
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link href={`/dns/${item.zone.id}?account=${item.accountId}`}>
							<Settings className="mr-1 h-3 w-3" />
							DNS
						</Link>
					</Button>
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
								className="text-destructive focus:text-destructive"
								onClick={() => setIsDeleteDialogOpen(true)}
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
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await copyToClipboard(nameserver, `Copied ${nameserver} to clipboard`, 'Failed to copy nameserver');
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 border">
			<code className="text-xs font-mono flex-1">{nameserver}</code>
			<Button
				size="sm"
				variant="ghost"
				className="h-7 w-7 p-0"
				onClick={handleCopy}
				title="Copy nameserver"
			>
				{copied ? (
					<Check className="h-3 w-3 text-green-600" />
				) : (
					<Copy className="h-3 w-3 opacity-50" />
				)}
			</Button>
		</div>
	);
});




