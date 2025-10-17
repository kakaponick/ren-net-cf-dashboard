import { useState } from 'react';
import { Edit2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAccountStore } from '@/store/account-store';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkEditARecordDialogProps {
		selectedZones: ZoneWithDNS[];
		onComplete: () => void;
		onRefreshDNS?: (zoneId: string, accountId: string) => void;
}

export function BulkEditARecordDialog({ selectedZones, onComplete, onRefreshDNS }: BulkEditARecordDialogProps) {
		const [open, setOpen] = useState(false);
		const [ipAddress, setIpAddress] = useState('');
		const [proxied, setProxied] = useState(false);
		const [isProcessing, setIsProcessing] = useState(false);
		const { accounts } = useAccountStore();

		const handleBulkUpdate = async () => {
				if (!ipAddress.trim()) {
					toast.error('Please enter an IP address');
					return;
				}

				// Basic IP validation
				const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
				if (!ipRegex.test(ipAddress.trim())) {
					toast.error('Please enter a valid IP address');
					return;
				}

				setIsProcessing(true);
				let successCount = 0;
				let failCount = 0;

				try {
					for (const zone of selectedZones) {
						const account = accounts.find(acc => acc.id === zone.accountId);
						if (!account) {
							console.error(`Account not found for zone ${zone.zone.name}`);
							failCount++;
							continue;
						}

						try {
							const api = new CloudflareAPI(account.apiToken);
							
							// Get all DNS records
							const dnsRecords = await api.getDNSRecords(zone.zone.id);
							
							// Find root A records
							const rootARecords = dnsRecords.filter(
									record => record.type === 'A' && 
									(record.name === zone.zone.name || record.name === '@' || record.name === '')
							);

							if (rootARecords.length === 0) {
								// Create new A record if none exists
								await api.createDNSRecord(zone.zone.id, {
									type: 'A',
									name: zone.zone.name,
									content: ipAddress.trim(),
									ttl: 1,
									proxied: proxied,
								});
							} else {
								// Update all root A records
								for (const record of rootARecords) {
									await api.updateDNSRecord(zone.zone.id, record.id, {
										type: 'A',
										name: record.name,
										content: ipAddress.trim(),
										ttl: record.ttl || 1,
										proxied: proxied,
									});
								}
							}
							
							// Refresh DNS records to update both local and global cache
							onRefreshDNS?.(zone.zone.id, zone.accountId);
							successCount++;
						} catch (error) {
							console.error(`Error updating ${zone.zone.name}:`, error);
							failCount++;
						}
					}

					if (successCount > 0) {
						toast.success(`Updated ${successCount} domain${successCount > 1 ? 's' : ''} successfully`);
					}
					if (failCount > 0) {
						toast.error(`Failed to update ${failCount} domain${failCount > 1 ? 's' : ''}`);
					}

					setOpen(false);
					setIpAddress('');
					setProxied(false);
					onComplete();
				} catch (error) {
					toast.error('Failed to complete bulk update');
					console.error('Bulk update error:', error);
				} finally {
					setIsProcessing(false);
				}
		};

		return (
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button size="sm" variant="default">
							<Edit2 className="h-4 w-4" />
							Edit A Records
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-4xl">
						<DialogHeader>
							<DialogTitle>Bulk Edit A Records</DialogTitle>
							<DialogDescription>
								Update A records for {selectedZones.length} selected domain{selectedZones.length > 1 ? 's' : ''}
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							<div className="grid w-full max-w-sm items-center gap-3">
								<Label htmlFor="ip-address">IP Address</Label>
								<Input
										id="ip-address"
										placeholder="192.168.1.1"
										value={ipAddress}
										onChange={(e) => setIpAddress(e.target.value)}
										disabled={isProcessing}
								/>
							</div>

							<div className="flex items-center justify-between">
								<Label htmlFor="proxied">Cloudflare Proxy</Label>
								<Switch
										id="proxied"
										checked={proxied}
										onCheckedChange={setProxied}
										disabled={isProcessing}
								/>
							</div>

						<div className="rounded-lg border bg-muted/50 p-4">
							<h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
								<span className="text-muted-foreground">Selected Domains</span>
								<span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
									{selectedZones.length}
								</span>
							</h4>
							<ScrollArea className="h-[500px]">

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
							<Button onClick={handleBulkUpdate} disabled={isProcessing}>
								{isProcessing ? 'Updating...' : 'Update A Records'}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
		);
}

