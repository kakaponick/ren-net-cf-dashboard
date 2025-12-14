import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import { SelectedDomainsList } from './selected-domains-list';

interface BulkDeleteDomainsDialogProps {
	selectedZones: ZoneWithDNS[];
	onComplete: () => void;
}

export function BulkDeleteDomainsDialog({ selectedZones, onComplete }: BulkDeleteDomainsDialogProps) {
	const [open, setOpen] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const { accounts } = useAccountStore();
	const { removeZone } = useCloudflareCache();

	const handleBulkDelete = async () => {
		setIsProcessing(true);
		let successCount = 0;
		let failCount = 0;
		const failedDomains: string[] = [];

		try {
			for (const zone of selectedZones) {
				const account = accounts.find(acc => acc.id === zone.accountId);
				if (!account) {
					console.error(`Account not found for zone ${zone.zone.name}`);
					failCount++;
					failedDomains.push(zone.zone.name);
					continue;
				}

				try {
					const api = new CloudflareAPI(account.apiToken);
					await api.deleteZone(zone.zone.id);
					// Remove zone from cache immediately
					removeZone(zone.zone.id, zone.accountId);
					successCount++;
				} catch (error) {
					console.error(`Error deleting ${zone.zone.name}:`, error);
					failCount++;
					failedDomains.push(zone.zone.name);
				}
			}

			if (successCount > 0) {
				toast.success(`Deleted ${successCount} domain${successCount > 1 ? 's' : ''} successfully`);
			}
			if (failCount > 0) {
				toast.error(
					`Failed to delete ${failCount} domain${failCount > 1 ? 's' : ''}: ${failedDomains.join(', ')}`
				);
			}

			setOpen(false);
			onComplete();
		} catch (error) {
			toast.error('Failed to complete bulk delete');
			console.error('Bulk delete error:', error);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" variant="outline" className="text-destructive gap-2">
					<Trash2 className="h-3.5 w-3.5" />
					Delete Domains
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle>Delete Domains</DialogTitle>
					<DialogDescription>
						This will permanently delete {selectedZones.length} selected domain{selectedZones.length > 1 ? 's' : ''}. This action cannot be undone and will remove all DNS records and settings for these domains.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<SelectedDomainsList 
						selectedZones={selectedZones}
						badgeVariant="destructive"
					/>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessing}>
						Cancel
					</Button>
					<Button 
						variant="destructive" 
						onClick={handleBulkDelete} 
						disabled={isProcessing}
					>
						{isProcessing ? 'Deleting...' : `Delete ${selectedZones.length} Domain${selectedZones.length > 1 ? 's' : ''}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

