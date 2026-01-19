import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Cloud } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAccountStore } from '@/store/account-store';
import { useBulkDomainCreation } from '@/hooks/use-bulk-domain-creation';
import { toast } from 'sonner';
import type { NamecheapDomain } from '@/types/namecheap';
import type { CloudflareAccount } from '@/types/cloudflare';

interface BulkImportDialogProps {
	selectedDomains: NamecheapDomain[];
	onComplete?: () => void;
}

export function BulkImportDialog({ selectedDomains, onComplete }: BulkImportDialogProps) {
	const [open, setOpen] = useState(false);
	const [selectedAccountId, setSelectedAccountId] = useState<string>('');
	const [rootIPAddress, setRootIPAddress] = useState('');
	const [proxied, setProxied] = useState(true);

	const { accounts: allAccounts } = useAccountStore();
	const accounts = allAccounts.filter(account => account.category === 'cloudflare');

	const selectedAccount = accounts.find(account => account.id === selectedAccountId);

	const {
		createDomains,
		isCreating,
		isConfiguring,
		domainQueue,
		resetQueue,
	} = useBulkDomainCreation({
		account: selectedAccount!,
		cloudflareAccountId: selectedAccount?.id || '',
		onSuccess: () => {
			toast.success('Bulk import completed!');
			setOpen(false);
			resetQueue();
			onComplete?.();
		},
	});

	const domainNames = selectedDomains.map(domain => domain.Name);

	const handleImport = useCallback(async () => {
		if (!selectedAccount || !rootIPAddress.trim()) {
			toast.error('Please select an account and provide a root IP address');
			return;
		}

		try {
			await createDomains(domainNames, rootIPAddress, proxied);
		} catch (error) {
			console.error('Bulk import failed:', error);
			toast.error('Failed to start bulk import');
		}
	}, [selectedAccount, rootIPAddress, proxied, domainNames, createDomains]);

	const handleOpenChange = useCallback((isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			resetQueue();
		}
	}, [resetQueue]);

	const isLoading = isCreating || isConfiguring;
	const pendingCount = domainQueue.filter(item => item.status === 'pending').length;
	const successCount = domainQueue.filter(item => item.status === 'success').length;
	const errorCount = domainQueue.filter(item => item.status === 'error').length;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button
					size="sm"
					variant="default"
					className="gap-2"
					disabled={selectedDomains.length === 0}
				>
					<Upload className="h-3.5 w-3.5" />
					Import to Cloudflare
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Cloud className="h-5 w-5" />
						Bulk Import Domains to Cloudflare
					</DialogTitle>
					<DialogDescription>
						Import {selectedDomains.length} selected domain{selectedDomains.length > 1 ? 's' : ''} from Namecheap to Cloudflare.
						This will create zones and configure default settings for each domain.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Cloudflare Account Selection */}
					<div className="space-y-2">
						<Label htmlFor="cloudflare-account">Cloudflare Account</Label>
						<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
							<SelectTrigger id="cloudflare-account">
								<SelectValue placeholder="Select Cloudflare account" />
							</SelectTrigger>
							<SelectContent>
								{accounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Root IP Address */}
					<div className="space-y-2">
						<Label htmlFor="root-ip">Root A Record IP Address</Label>
						<Input
							id="root-ip"
							placeholder="192.168.1.1"
							value={rootIPAddress}
							onChange={(e) => setRootIPAddress(e.target.value)}
							disabled={isLoading}
						/>
						<p className="text-sm text-muted-foreground">
							The IP address to point the root A record to for each domain.
						</p>
					</div>

					{/* Proxy Setting */}
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="proxied">Proxy through Cloudflare</Label>
							<p className="text-sm text-muted-foreground">
								Enable Cloudflare proxying for the root A record.
							</p>
						</div>
						<Switch
							id="proxied"
							checked={proxied}
							onCheckedChange={setProxied}
							disabled={isLoading}
						/>
					</div>

					{/* Domain List Preview */}
					<div className="space-y-2">
						<Label>Domains to Import ({domainNames.length})</Label>
						<div className="max-h-32 overflow-y-auto border rounded-md p-3 bg-muted/30">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
								{domainNames.slice(0, 10).map((domain) => (
									<div key={domain} className="font-mono text-xs truncate">
										{domain}
									</div>
								))}
								{domainNames.length > 10 && (
									<div className="text-xs text-muted-foreground">
										...and {domainNames.length - 10} more
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Progress Display */}
					{domainQueue.length > 0 && (
						<div className="space-y-2">
							<Label>Import Progress</Label>
							<div className="flex gap-4 text-sm">
								<span className="text-muted-foreground">
									Pending: {pendingCount}
								</span>
								<span className="text-green-600">
									Success: {successCount}
								</span>
								<span className="text-red-600">
									Error: {errorCount}
								</span>
							</div>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={isLoading}
					>
						Cancel
					</Button>
					<Button
						onClick={handleImport}
						disabled={!selectedAccount || !rootIPAddress.trim() || isLoading}
						className="gap-2"
					>
						{isLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Upload className="h-4 w-4" />
						)}
						{isLoading ? 'Importing...' : 'Start Import'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}