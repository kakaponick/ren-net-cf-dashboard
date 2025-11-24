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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { NameserversSection } from '@/components/nameservers-section';
import { ConfigurationConsole } from '@/components/configuration-console';
import { toast } from 'sonner';
import type { CloudflareAccount } from '@/types/cloudflare';
import { validateDomain, validateIPAddress, parseBulkDomains } from '@/lib/utils';
import { useCloudflareAccounts } from '@/hooks/use-cloudflare-accounts';
import { useDomainCreation } from '@/hooks/use-domain-creation';
import { useBulkDomainCreation } from '@/hooks/use-bulk-domain-creation';
import { DomainInputForm } from './add-domain-dialog/DomainInputForm';
import { BulkDomainInputForm } from './add-domain-dialog/BulkDomainInputForm';
import { RootARecordInput } from './add-domain-dialog/RootARecordInput';
import { AccountSelectors } from './add-domain-dialog/AccountSelectors';

type AddDomainDialogProps = {
	accounts: CloudflareAccount[];
	onDomainCreated: () => void;
	title: string;
};

export function AddDomainDialog({ title, accounts, onDomainCreated }: AddDomainDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [mode, setMode] = useState<'single' | 'bulk'>('single');
	const [newDomainName, setNewDomainName] = useState('');
	const [bulkDomains, setBulkDomains] = useState('');
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

	const singleDomainCreation = useDomainCreation({
		account: selectedAccount || accountsToUse[0] || accounts[0],
		cloudflareAccountId: selectedCloudflareAccountId,
		onSuccess: onDomainCreated,
	});

	const bulkDomainCreation = useBulkDomainCreation({
		account: selectedAccount || accountsToUse[0] || accounts[0],
		cloudflareAccountId: selectedCloudflareAccountId,
		onSuccess: onDomainCreated,
	});

	const isCreating = singleDomainCreation.isCreating || bulkDomainCreation.isCreating;
	const isConfiguring = singleDomainCreation.isConfiguring || bulkDomainCreation.isConfiguring;
	const isProcessing = isCreating || isConfiguring;

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

	const handleCreateDomain = async () => {
		if (mode === 'bulk') {
			await handleBulkCreateDomains();
			return;
		}

		if (!newDomainName.trim()) {
			toast.error('Please enter a domain name');
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

		if (!validateDomain(newDomainName.trim())) {
			toast.error('Please enter a valid domain name (e.g., example.com)');
			return;
		}

		if (rootIPAddress.trim() && !validateIPAddress(rootIPAddress)) {
			toast.error('Please enter a valid IP address');
			return;
		}

		await singleDomainCreation.createDomain(
			newDomainName.trim(),
			rootIPAddress.trim(),
			proxied
		);
	};

	const handleBulkCreateDomains = async () => {
		if (!bulkDomains.trim()) {
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

		const domains = parseBulkDomains(bulkDomains);
		if (domains.length === 0) {
			toast.error('No valid domains found. Please enter valid domain names (one per line)');
			return;
		}

		await bulkDomainCreation.createDomains(domains, rootIPAddress.trim(), proxied);
	};

	const handleClose = () => {
		bulkDomainCreation.cancel();
		setIsOpen(false);
		setNewDomainName('');
		setBulkDomains('');
		setSelectedAccountId('');
		setSelectedCloudflareAccountId('');
		setRootIPAddress('');
		setProxied(true);
		setMode('single');
	};

	const showProgress = isProcessing || 
		singleDomainCreation.configurationSteps.length > 0 || 
		bulkDomainCreation.domainQueue.length > 0;

	const showNameservers = mode === 'single' && singleDomainCreation.createdNameservers.length > 0;
	const canCreate = (mode === 'single' && !showNameservers) || 
		(mode === 'bulk' && bulkDomainCreation.domainQueue.length === 0);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild title={title}>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Add Domain
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Add New Domain</DialogTitle>
					<DialogDescription>
						Add a new domain or multiple domains to your Cloudflare account. Select which account to use.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<Tabs value={mode} onValueChange={(value) => setMode(value as 'single' | 'bulk')} className="w-full">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="single" disabled={isProcessing}>Single Domain</TabsTrigger>
							<TabsTrigger value="bulk" disabled={isProcessing}>Bulk Add</TabsTrigger>
						</TabsList>

						<TabsContent value="single" className="space-y-4 mt-4">
							<DomainInputForm
								value={newDomainName}
								onChange={setNewDomainName}
								onSubmit={handleCreateDomain}
								disabled={isProcessing}
							/>
						</TabsContent>

						<TabsContent value="bulk" className="space-y-4 mt-4">
							<BulkDomainInputForm
								value={bulkDomains}
								onChange={setBulkDomains}
								disabled={isProcessing}
							/>
						</TabsContent>
					</Tabs>

					<RootARecordInput
						ipAddress={rootIPAddress}
						proxied={proxied}
						onIPChange={setRootIPAddress}
						onProxiedChange={setProxied}
						onSubmit={handleCreateDomain}
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

					{showProgress && (
						<div className="space-y-2">
							<ConfigurationConsole
								steps={mode === 'single' ? singleDomainCreation.configurationSteps : undefined}
								domainQueue={mode === 'bulk' ? bulkDomainCreation.domainQueue : undefined}
								title={
									mode === 'bulk'
										? 'Domain Creation Queue'
										: isConfiguring
											? 'Configuring Default Settings'
											: 'Domain Creation Progress'
								}
							/>
						</div>
					)}

					{showNameservers && (
						<NameserversSection nameservers={singleDomainCreation.createdNameservers} />
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleClose}
						disabled={isProcessing}
					>
						{canCreate ? 'Cancel' : 'Close'}
					</Button>
					{canCreate && (
						<Button onClick={handleCreateDomain} disabled={isProcessing}>
							{isProcessing ? (
								<>
									<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
									{isConfiguring ? 'Configuring...' : mode === 'bulk' ? 'Creating Domains...' : 'Creating...'}
								</>
							) : (
								<>
									<Plus className="mr-2 h-4 w-4" />
									{mode === 'bulk' 
										? `Create ${parseBulkDomains(bulkDomains).length} Domain${parseBulkDomains(bulkDomains).length !== 1 ? 's' : ''}` 
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
