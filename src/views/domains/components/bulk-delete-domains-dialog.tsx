import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkDeleteDomainsDialogProps {
	selectedZones: ZoneWithDNS[];
	onComplete: () => void;
}

export function BulkDeleteDomainsDialog({ selectedZones, onComplete }: BulkDeleteDomainsDialogProps) {
	const [open, setOpen] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const { accounts } = useAccountStore();

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
				<Button size="sm" variant="outline" className="text-destructive">
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
					<div className="rounded-lg border bg-muted/50 p-4">
						<h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
							<span className="text-muted-foreground">Selected Domains</span>
							<span className="text-xs font-normal bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
								{selectedZones.length}
							</span>
						</h4>
						<ScrollArea className="h-[400px]">
							<div className="pr-4 grid grid-cols-3 gap-1">
								{selectedZones.map((zone) => (
									<div
										key={`${zone.accountId}-${zone.zone.id}`}
										className="text-sm text-foreground bg-background/60 px-2 py-1 rounded-md border border-border/50"
									>
										<span className="font-mono">{zone.zone.name}</span>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>
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

