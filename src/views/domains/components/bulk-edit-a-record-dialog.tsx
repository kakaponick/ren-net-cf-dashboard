import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Network, CloudCheck, Loader2, Globe } from 'lucide-react';
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
import { validateIPAddress } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { SelectedDomainsList } from './selected-domains-list';

interface BulkEditARecordDialogProps {
		selectedZones: ZoneWithDNS[];
		onComplete: () => void;
		onRefreshDNS?: (zoneId: string, accountId: string) => void;
}

export function BulkEditARecordDialog({ selectedZones, onComplete, onRefreshDNS }: BulkEditARecordDialogProps) {
		const [open, setOpen] = useState(false);
		const [ipAddress, setIpAddress] = useState('');
		const [proxied, setProxied] = useState(true);
		const [isProcessing, setIsProcessing] = useState(false);
		const [processedCount, setProcessedCount] = useState(0);
		const { accounts } = useAccountStore();

		const handleBulkUpdate = async () => {
				if (!ipAddress.trim()) {
					toast.error('Please enter an IP address');
					return;
				}

				if (!validateIPAddress(ipAddress)) {
					toast.error('Please enter a valid IP address');
					return;
				}

				setIsProcessing(true);
				setProcessedCount(0);
				let successCount = 0;
				let failCount = 0;

				try {
					for (let i = 0; i < selectedZones.length; i++) {
						const zone = selectedZones[i];
						setProcessedCount(i + 1);
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
					setProcessedCount(0);
					onComplete();
				} catch (error) {
					toast.error('Failed to complete bulk update');
					console.error('Bulk update error:', error);
				} finally {
					setIsProcessing(false);
					setProcessedCount(0);
				}
		};

		const progressPercentage = selectedZones.length > 0 
			? (processedCount / selectedZones.length) * 100 
			: 0;

		const handleOpenChange = (newOpen: boolean) => {
			setOpen(newOpen);
			if (!newOpen) {
				// Reset form when dialog closes
				setIpAddress('');
				setProxied(false);
				setProcessedCount(0);
			}
		};

		return (
				<Dialog open={open} onOpenChange={handleOpenChange}>
					<DialogTrigger asChild>
						<Button size="sm" variant="outline" className="gap-2">
							<Pencil className="h-3.5 w-3.5" />
							Edit A Records
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 w-[95vw] sm:w-full">
						<DialogHeader className="px-4 sm:px-6 pt-6 pb-4 flex-shrink-0 border-b">
							<DialogTitle>
								Bulk Edit A Records
							</DialogTitle>
							<DialogDescription>
								Update A records for {selectedZones.length} selected domain{selectedZones.length > 1 ? 's' : ''}
							</DialogDescription>
						</DialogHeader>

						<div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 min-h-0">
							{isProcessing && (
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Processing domains...</span>
										<span className="font-medium">
											{processedCount} / {selectedZones.length}
										</span>
									</div>
									<Progress value={progressPercentage} className="h-2" />
								</div>
							)}

							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="ip-address" className="flex items-center gap-2">
										<Network className="h-4 w-4 text-muted-foreground" />
										IP Address
									</Label>
									<Input
										id="ip-address"
										placeholder="192.168.1.1"
										value={ipAddress}
										onChange={(e) => setIpAddress(e.target.value)}
										disabled={isProcessing}
										className="w-full"
									/>
									<p className="text-xs text-muted-foreground">
										Enter the IPv4 address for the root A record
									</p>
								</div>

								<Label 
									htmlFor="proxied" 
									className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-4 cursor-pointer has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10"
								>
									
									<div className="grid gap-1.5 font-normal flex-1">
										<div className="flex items-center gap-2">
											<CloudCheck className="h-4 w-4 text-muted-foreground" />
											<p className="text-sm leading-none font-medium">
												Cloudflare Proxy
											</p>
										</div>
										<p className="text-muted-foreground text-sm">
											Enable Cloudflare's proxy and DDoS protection
										</p>
									</div>
									<Switch
										id="proxied"
										checked={proxied}
										onCheckedChange={setProxied}
										disabled={isProcessing}
										className="mt-0.5"
									/>
								</Label>
							</div>

							<SelectedDomainsList 
								selectedZones={selectedZones}
								icon={Globe}
								showAccount={true}
							/>
						</div>

						<DialogFooter className="px-4 sm:px-6 py-4 border-t flex-shrink-0 gap-2">
							<Button 
								variant="outline" 
								onClick={() => {
									setOpen(false);
									setIpAddress('');
									setProxied(false);
									setProcessedCount(0);
								}} 
								disabled={isProcessing}
								className="w-full sm:w-auto"
							>
								Cancel
							</Button>
							<Button 
								onClick={handleBulkUpdate} 
								disabled={isProcessing || !ipAddress.trim()}
								className="w-full sm:w-auto gap-2"
							>
								{isProcessing ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Updating...
									</>
								) : (
									'Update A Records'
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
		);
}

