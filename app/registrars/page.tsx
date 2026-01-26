'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useSelection } from '@/hooks/use-selection';
import { useRegistrars } from '@/hooks/use-registrars';
import { useAccountStore } from '@/store/account-store';
import { copyToClipboard } from '@/lib/utils';
import { RegistrarDomainsTable } from '@/views/registrars/components/registrar-domains-table';
import { RegistrarPageHeader } from '@/views/registrars/components/registrar-page-header';
import { SelectionToolbar } from '@/views/registrars/components/selection-toolbar';
import { Globe, RefreshCw } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { useRegistrarFilterSort } from '@/views/registrars/hooks/use-registrar-filter-sort';
import { useLoadingToast } from '@/views/registrars/hooks/use-loading-toast';

export default function RegistrarsPage() {
	const router = useRouter();
	const { loadAccounts, loadProxyAccounts } = useAccountStore();
	const {
		domains,
		isLoading,
		isRefreshing,
		namecheapAccounts,
		njallaAccounts,
		loadDomains,
		refreshAccount,
	} = useRegistrars();

	// Load accounts from localStorage on mount
	useEffect(() => {
		loadAccounts();
		loadProxyAccounts();
	}, [loadAccounts, loadProxyAccounts]);

	const {
		searchTerm,
		setSearchTerm,
		clearSearch,
		selectedAccount,
		setSelectedAccount,
		selectedRegistrar,
		setSelectedRegistrar,
		sortField,
		sortDirection,
		handleSort,
		sortedDomains,
	} = useRegistrarFilterSort(domains);

	const domainCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		domains.forEach((d) => {
			if (d.accountId) {
				counts[d.accountId] = (counts[d.accountId] || 0) + 1;
			}
		});
		return counts;
	}, [domains]);

	const handleAccountChange = (accountId: string) => {
		setSelectedAccount(accountId);
		
		// If selecting a specific account and it has no domains loaded, trigger refresh
		if (accountId !== 'all') {
			const count = domainCounts[accountId] || 0;
			if (count === 0) {
				refreshAccount(accountId);
			}
		}
	};

	const currentIds = useMemo(
		() => sortedDomains.map((domain) => domain.id),
		[sortedDomains]
	);

	const { isSelected, toggleOne, toggleAll, clear, allSelected, selectedCount } =
		useSelection(currentIds);

	const selectedDomains = useMemo(
		() => sortedDomains.filter((domain) => isSelected(domain.id)),
		[sortedDomains, isSelected]
	);

	const stats = useMemo(
		() => ({
			total: domains.length,
			visible: sortedDomains.length,
			selected: selectedCount,
		}),
		[domains.length, sortedDomains.length, selectedCount]
	);

	const handleCopySelected = async () => {
		if (selectedDomains.length === 0) return;
		const domainsText = selectedDomains.map((domain) => domain.name).join('\n');
		await copyToClipboard(
			domainsText,
			`Copied ${selectedDomains.length} domain${selectedDomains.length > 1 ? 's' : ''}`,
			'Failed to copy selected domains'
		);
	};

	const handleRefresh = () => {
		if (selectedAccount && selectedAccount !== 'all') {
			refreshAccount(selectedAccount);
		} else {
			loadDomains(true);
		}
	};

	useLoadingToast(isRefreshing, 'Loading domains...');
	useLoadingToast(isLoading, 'Loading domains...');

	return (
		<div className="space-y-6 h-full flex flex-col">
			<RegistrarPageHeader
				stats={stats}
				searchTerm={searchTerm}
				onSearchChange={setSearchTerm}
				onClearSearch={clearSearch}
				onRefresh={handleRefresh}
				isRefreshing={isRefreshing}
				namecheapAccounts={namecheapAccounts}
				njallaAccounts={njallaAccounts}
				selectedAccount={selectedAccount}
				onAccountChange={handleAccountChange}
				selectedRegistrar={selectedRegistrar}
				onRegistrarChange={setSelectedRegistrar}
				domainCounts={domainCounts}
			/>

			{/* Main content */}
			<SelectionToolbar
				selectedCount={selectedCount}
				selectedDomains={selectedDomains}
				onCopySelected={() => void handleCopySelected()}
				onClearSelection={clear}
			/>

			{isLoading || isRefreshing ? (
				<div className="flex items-center justify-center py-12 flex-1">
					<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			) : sortedDomains.length === 0 ? (
				<Empty className="border inline-flex flex-1">
					<EmptyMedia variant="icon">
						<Globe className="h-6 w-6" />
					</EmptyMedia>
					<EmptyHeader>
						<EmptyTitle>
							{searchTerm ? 'No domains found' : 'No domains available'}
						</EmptyTitle>
						<EmptyDescription>
							{searchTerm
								? 'Try adjusting your search terms'
								: 'No domains found in your registrar accounts.'}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<Card>
					<div className="overflow-x-auto">
						<RegistrarDomainsTable
							domains={sortedDomains}
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={handleSort}
							isSelected={isSelected}
							onToggle={toggleOne}
							onToggleAll={toggleAll}
							allSelected={allSelected}
							selectedCount={selectedCount}
						/>
					</div>
				</Card>
			)}
		</div>
	);
}
