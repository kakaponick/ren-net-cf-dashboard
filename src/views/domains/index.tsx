'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSelection } from '@/hooks/use-selection';
import { useDomainsData } from './hooks/use-domains-data';
import { useDomainsFilter } from './hooks/use-domains-filter';
import { useDomainsSort, type SortField, type SortDirection } from './hooks/use-domains-sort';
import { DomainsTable } from './components/domains-table';
import { AddDomainDialog } from './components/add-domain-dialog';
import { BulkEditARecordDialog } from './components/bulk-edit-a-record-dialog';
import { useCloudflareCache } from '@/store/cloudflare-cache';

export default function DomainsPage() {
	const router = useRouter();
	const { enrichedZones, isLoading, loadZones, loadDNSForZone, accountsLoading, accounts } = useDomainsData();
	const { zones, isCacheValid } = useCloudflareCache();

	// Log cache info to console
	if (isCacheValid('zones') && zones.length > 0) {
		console.log(`Cache: ${enrichedZones.length} of ${zones.length} domains loaded`);
	}

	const [searchTerm, setSearchTerm] = useState('');
	const [sortField, setSortField] = useState<SortField>('name');
	const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

	const filteredZones = useDomainsFilter(enrichedZones, searchTerm);
	const sortedZones = useDomainsSort(filteredZones, sortField, sortDirection);

	const currentIds = useMemo(
		() => sortedZones.map((item) => `${item.accountId}-${item.zone.id}`),
		[sortedZones]
	);

	const { isSelected, toggleOne, toggleAll, clear, allSelected, selectedCount } = useSelection(currentIds);

	const selectedZones = useMemo(() => {
		return sortedZones.filter((zone) => isSelected(`${zone.accountId}-${zone.zone.id}`));
	}, [sortedZones, isSelected]);

	const handleSort = useCallback((field: SortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			setSortField(field);
			setSortDirection('asc');
		}
	}, [sortField, sortDirection]);

	const handleRefresh = useCallback(() => {
		loadZones(true);
	}, [loadZones]);

	const handleRefreshDNS = useCallback((zoneId: string, accountId: string) => {
		loadDNSForZone(zoneId, accountId);
	}, [loadDNSForZone]);

	if (accountsLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Card>
					<CardContent className="text-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
						<h3 className="text-lg font-medium mb-2">Loading Accounts...</h3>
						<p className="text-muted-foreground">
							Please wait while we load your Cloudflare accounts
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (accounts.length === 0) {
		return (
			<div className="flex items-center justify-center h-64">
				<Card>
					<CardContent className="text-center py-8">
					<h3 className="text-lg font-medium mb-2">No Accounts Added</h3>
					<p className="text-muted-foreground mb-4">
						Please add Cloudflare accounts to view domains
					</p>
					<Button onClick={() => router.push('/accounts')}>
						Go to Accounts
					</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Domains</h1>
					<p className="text-muted-foreground">
						Manage your Cloudflare zones and domains from all accounts
					</p>
				</div>

				<div className="flex items-center space-x-2 flex-nowrap">
					

					<div className="relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
						<Input
							placeholder="Search domain, IP, account"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10 w-96"
						/>
					</div>

					<Button
						onClick={handleRefresh}
						disabled={isLoading}
						variant="outline"
					>
						<RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
						Refresh Cache
					</Button>
					<AddDomainDialog title="Loading all domains across accounts can take up to 30 seconds for large accounts (100 domains ~ 30s)" accounts={accounts} onDomainCreated={handleRefresh} />

				</div>
			</div>

			{selectedCount > 0 && (
				<Card className="bg-primary/5 border-primary/20">
					<CardContent className="py-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-2">
								<span className="text-sm font-medium text-primary">
									{selectedCount} domain{selectedCount > 1 ? 's' : ''} selected
								</span>
							</div>
							<div className="flex items-center space-x-2">
								<BulkEditARecordDialog
									selectedZones={selectedZones}
									onComplete={() => clear()}
									onRefreshDNS={handleRefreshDNS}
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={clear}
								>
									Clear Selection
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{isLoading ? (
				<Card>
					<CardContent className="py-8">
						<div className="text-center">
							<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
							<p>Loading domains from all accounts...</p>
							<p className="text-sm text-muted-foreground mt-2">
								This may take a moment if you have many domains
							</p>
						</div>
					</CardContent>
				</Card>
			) : sortedZones.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Globe className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-medium mb-2">
							{searchTerm ? 'No domains found' : 'No domains available'}
						</h3>
						<p className="text-muted-foreground text-center">
							{searchTerm
								? 'Try adjusting your search terms'
								: 'No domains found in any of your accounts'
							}
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<div className="overflow-x-auto">
						<DomainsTable
							zones={sortedZones}
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={handleSort}
							isSelected={isSelected}
							onToggle={toggleOne}
							onToggleAll={toggleAll}
							allSelected={allSelected}
							selectedCount={selectedCount}
							onRefreshDNS={handleRefreshDNS}
						/>
					</div>
				</Card>
			)}
		</div>
	);
}




