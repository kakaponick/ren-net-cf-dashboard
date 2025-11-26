import { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConfigurationConsole } from '@/components/configuration-console';
import { toast } from 'sonner';
import type { CloudflareAccount } from '@/types/cloudflare';
import { validateIPAddress, parseBulkDomains } from '@/lib/utils';
import { useCloudflareAccounts } from '@/hooks/use-cloudflare-accounts';
import { useBulkDomainCreation } from '@/hooks/use-bulk-domain-creation';
import { BulkDomainInputForm } from './BulkDomainInputForm';
import { RootARecordInput } from './RootARecordInput';
import { AccountSelectors } from './AccountSelectors';

type AddDomainDialogProps = {
	accounts: CloudflareAccount[];
	onDomainCreated: () => void;
	title: string;
};

export function AddDomainDialog({ title, accounts, onDomainCreated }: AddDomainDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [domains, setDomains] = useState('');
	const [selectedAccountId, setSelectedAccountId] = useState('');
	const [selectedCloudflareAccountId, setSelectedCloudflareAccountId] = useState('');
	const [rootIPAddress, setRootIPAddress] = useState('');
	const [proxied, setProxied] = useState(true);

	const { accountsToUse, cloudflareAccounts, isLoadingAccounts } = useCloudflareAccounts({
		selectedAccountId,
		accounts,
	});

	const selectedAccount = accountsToUse.find(acc => acc.id === selectedAccountId);
	const hasValidAccount = selectedAccount && selectedCloudflareAccountId;

	const bulkDomainCreation = useBulkDomainCreation({
		account: selectedAccount || accountsToUse[0] || accounts[0],
		cloudflareAccountId: selectedCloudflareAccountId,
		onSuccess: onDomainCreated,
	});

	const isProcessing = bulkDomainCreation.isCreating || bulkDomainCreation.isConfiguring;

	// Auto-select first API account when dialog opens
	useEffect(() => {
		if (isOpen && accountsToUse.length > 0 && !selectedAccountId) {
			setSelectedAccountId(accountsToUse[0].id);
		}
	}, [isOpen, accountsToUse, selectedAccountId]);

	// Auto-select first Cloudflare account if only one exists
	useEffect(() => {
		if (cloudflareAccounts.length === 1 && !selectedCloudflareAccountId) {
			setSelectedCloudflareAccountId(cloudflareAccounts[0].id);
		} else if (cloudflareAccounts.length === 0 && selectedCloudflareAccountId) {
			setSelectedCloudflareAccountId('');
		}
	}, [cloudflareAccounts, selectedCloudflareAccountId]);

	const handleCreateDomains = async () => {
		if (!domains.trim()) {
			toast.error('Please enter domain names');
			return;
		}

		if (!hasValidAccount) {
			if (!selectedAccountId) {
				toast.error('Please select an account');
			} else if (!selectedCloudflareAccountId) {
				toast.error('Please select a Cloudflare account');
			} else {
				toast.error('Selected account not found');
			}
			return;
		}

		if (rootIPAddress.trim() && !validateIPAddress(rootIPAddress)) {
			toast.error('Please enter a valid IP address');
			return;
		}

		const parsedDomains = parseBulkDomains(domains);
		if (parsedDomains.length === 0) {
			toast.error('No valid domains found. Please enter valid domain names (one per line)');
			return;
		}

		await bulkDomainCreation.createDomains(parsedDomains, rootIPAddress.trim(), proxied);
	};

	const handleClose = () => {
		bulkDomainCreation.cancel();
		setIsOpen(false);
		setDomains('');
		setSelectedAccountId('');
		setSelectedCloudflareAccountId('');
		setRootIPAddress('');
		setProxied(true);
	};

	const showProgress = isProcessing || bulkDomainCreation.domainQueue.length > 0;
	const canCreate = bulkDomainCreation.domainQueue.length === 0;
	const validDomainsCount = parseBulkDomains(domains).length;

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild title={title}>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Add Domain
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
				<DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
					<DialogTitle>Add Domain</DialogTitle>
					<DialogDescription>
						Add one or multiple domains to your Cloudflare account. Enter domain names one per line.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 space-y-4 min-h-0">
					{!showProgress && (
						<>
							<BulkDomainInputForm
								value={domains}
								onChange={setDomains}
								disabled={isProcessing}
							/>

							<RootARecordInput
								ipAddress={rootIPAddress}
								proxied={proxied}
								onIPChange={setRootIPAddress}
								onProxiedChange={setProxied}
								onSubmit={handleCreateDomains}
								disabled={isProcessing}
							/>

							<AccountSelectors
								accounts={accountsToUse}
								cloudflareAccounts={cloudflareAccounts}
								selectedAccountId={selectedAccountId}
								selectedCloudflareAccountId={selectedCloudflareAccountId}
								isLoadingAccounts={isLoadingAccounts}
								onAccountChange={setSelectedAccountId}
								onCloudflareAccountChange={setSelectedCloudflareAccountId}
								disabled={isProcessing}
							/>
						</>
					)}

					{showProgress && (
						<div className="pb-4 flex-1 min-h-0 flex flex-col">
							<ConfigurationConsole
								domainQueue={bulkDomainCreation.domainQueue}
								title="Domain Creation Queue"
								className="flex-1 min-h-0"
							/>
						</div>
					)}
				</div>

				<DialogFooter className="px-6 py-4 border-t flex-shrink-0">
					<Button
						variant="outline"
						onClick={handleClose}
						disabled={isProcessing}
					>
						{canCreate ? 'Cancel' : 'Close'}
					</Button>
					{canCreate && (
						<Button onClick={handleCreateDomains} disabled={isProcessing || validDomainsCount === 0}>
							{isProcessing ? (
								<>
									<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
									{bulkDomainCreation.isConfiguring ? 'Configuring...' : 'Creating Domains...'}
								</>
							) : (
								<>
									<Plus className="mr-2 h-4 w-4" />
									{validDomainsCount > 0
										? `Create ${validDomainsCount} Domain${validDomainsCount !== 1 ? 's' : ''}`
										: 'Create Domain'}
								</>
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
