import { useEffect, useMemo, useState } from 'react';
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
import { useAccountStore } from '@/store/account-store';
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
	const [selectedRegistrarAccountId, setSelectedRegistrarAccountId] = useState('');
	const [rootIPAddress, setRootIPAddress] = useState('');
	const [proxied, setProxied] = useState(true);

	// Derive registrar accounts from the store
	const allAccounts = useAccountStore((s) => s.accounts);
	const proxyAccounts = useAccountStore((s) => s.proxyAccounts);
	const registrarAccounts = useMemo(() =>
		allAccounts
			.filter((a) => a.category === 'registrar' && (a.registrarName === 'namecheap' || a.registrarName === 'njalla'))
			.map((a) => ({
				id: a.id,
				name: a.name || a.email || 'Unnamed',
				registrar: a.registrarName as 'namecheap' | 'njalla',
			})),
		[allAccounts]);

	const { accountsToUse, cloudflareAccounts, isLoadingAccounts } = useCloudflareAccounts({
		selectedAccountId,
		accounts,
	});

	const selectedAccount = accountsToUse.find(acc => acc.id === selectedAccountId);
	const hasValidAccount = selectedAccount && selectedCloudflareAccountId;

	const bulkDomainCreation = useBulkDomainCreation({
		account: selectedAccount || accountsToUse[0] || accounts[0],
		cloudflareAccountId: selectedCloudflareAccountId,
		registrarAccountId: selectedRegistrarAccountId || undefined,
		registrarAccounts: allAccounts,
		proxyAccounts,
		onSuccess: onDomainCreated,
	});

	const isProcessing = bulkDomainCreation.isCreating || bulkDomainCreation.isConfiguring;

	const queueStats = useMemo(() => {
		const total = bulkDomainCreation.domainQueue.length;
		const completed = bulkDomainCreation.domainQueue.filter((item) => item.status === 'success').length;
		const failed = bulkDomainCreation.domainQueue.filter((item) => item.status === 'error').length;
		const inProgress = bulkDomainCreation.domainQueue.some((item) => item.status === 'processing');
		return { total, completed, failed, inProgress };
	}, [bulkDomainCreation.domainQueue]);

	// Auto-select first API account when dialog opens
	useEffect(() => {
		if (isOpen && accountsToUse.length > 0 && !selectedAccountId) {
			setSelectedAccountId(accountsToUse[0].id);
		}
	}, [isOpen, accountsToUse, selectedAccountId]);

	// Reset Cloudflare account selection when API account changes
	useEffect(() => {
		if (selectedAccountId) {
			setSelectedCloudflareAccountId('');
		}
	}, [selectedAccountId]);

	// Auto-select first Cloudflare account if only one exists (after loading completes)
	useEffect(() => {
		if (!selectedAccountId || isLoadingAccounts) {
			return;
		}

		if (cloudflareAccounts.length === 1 && !selectedCloudflareAccountId) {
			setSelectedCloudflareAccountId(cloudflareAccounts[0].id);
		} else if (cloudflareAccounts.length === 0 && selectedCloudflareAccountId) {
			setSelectedCloudflareAccountId('');
		}
	}, [cloudflareAccounts, selectedCloudflareAccountId, selectedAccountId, isLoadingAccounts]);

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

		// Clear domain input after adding to queue (but keep other settings)
		setDomains('');
	};

	const handleClose = () => {
		bulkDomainCreation.resetQueue();
		setIsOpen(false);
		setDomains('');
		setSelectedAccountId('');
		setSelectedCloudflareAccountId('');
		setSelectedRegistrarAccountId('');
		setRootIPAddress('');
		setProxied(true);
	};

	const handleDialogChange = (open: boolean) => {
		if (!open) {
			handleClose();
			return;
		}

		setIsOpen(true);
	};

	const hasQueue = queueStats.total > 0;
	const validDomainsCount = parseBulkDomains(domains).length;

	return (
		<Dialog open={isOpen} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild title={title}>
				<Button size="sm">
					<Plus className="h-3.5 w-3.5" />
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
					<BulkDomainInputForm
						value={domains}
						onChange={setDomains}
						disabled={false}
					/>

					<RootARecordInput
						ipAddress={rootIPAddress}
						proxied={proxied}
						onIPChange={setRootIPAddress}
						onProxiedChange={setProxied}
						onSubmit={handleCreateDomains}
						disabled={false}
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
						registrarAccounts={registrarAccounts}
						selectedRegistrarAccountId={selectedRegistrarAccountId}
						onRegistrarAccountChange={setSelectedRegistrarAccountId}
					/>

					{hasQueue && (
						<div className="pb-4 flex-1 min-h-0 flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<p className="text-sm font-semibold">
										{isProcessing || queueStats.inProgress ? 'Domain creation in progress' : 'Last run summary'}
									</p>
									<p className="text-xs text-muted-foreground">
										Queue updates in real time. You can start another batch without closing this dialog.
									</p>
									<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
										<span>
											Completed {queueStats.completed}/{queueStats.total}
										</span>
										{queueStats.failed > 0 && (
											<span className="text-destructive">
												Failed {queueStats.failed}
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{isProcessing ? (
										<Button
											variant="outline"
											size="sm"
											onClick={bulkDomainCreation.cancel}
											disabled={!isProcessing}
										>
											Stop run
										</Button>
									) : (
										<Button
											variant="ghost"
											size="sm"
											onClick={bulkDomainCreation.resetQueue}
										>
											Clear log
										</Button>
									)}
								</div>
							</div>
							<ConfigurationConsole
								domainQueue={bulkDomainCreation.domainQueue}
								title="Domain Creation Queue"
								className="flex-1 min-h-[420px]"
								maxHeight="70vh"
								dense
								onRetryStep={bulkDomainCreation.retryStep}
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
						Close
					</Button>
					<Button onClick={handleCreateDomains} disabled={validDomainsCount === 0}>
						{isProcessing ? (
							<>
								<Plus className="mr-2 h-4 w-4" />
								{validDomainsCount > 0
									? `Add ${validDomainsCount} Domain${validDomainsCount !== 1 ? 's' : ''} to Queue`
									: 'Add to Queue'}
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
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
