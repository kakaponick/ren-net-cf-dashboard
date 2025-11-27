'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Search, RefreshCw, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useSelection } from '@/hooks/use-selection';
import { useDomainsData } from './hooks/use-domains-data';
import { useDomainsFilter } from './hooks/use-domains-filter';
import { useDomainsSort, type SortField, type SortDirection } from './hooks/use-domains-sort';
import { DomainsTable } from './components/domains-table';
import { AddDomainDialog } from './components/add-domain-dialog';
import { BulkEditARecordDialog } from './components/bulk-edit-a-record-dialog';
import { BulkDeleteDomainsDialog } from './components/bulk-delete-domains-dialog';
import { useCloudflareCache } from '@/store/cloudflare-cache';

export default function DomainsPage() {
	const router = useRouter();
	const { enrichedZones, isLoading, dnsLoadingProgress, loadZones, loadDNSForZone, accountsLoading, accounts } = useDomainsData();
	const { zones, isCacheValid, clearCache } = useCloudflareCache();

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
		clearCache();
		loadZones();
	}, [clearCache, loadZones]);

	const handleDomainCreated = useCallback(() => {
		// Zones are already added reactively via addZone() in use-bulk-domain-creation
		// No need to reload - the cache updates automatically trigger table rerender
	}, []);

	const handleRefreshDNS = useCallback((zoneId: string, accountId: string) => {
		loadDNSForZone(zoneId, accountId);
	}, [loadDNSForZone]);

	if (accountsLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Card>
					<CardContent className="text-center py-8">
						<Spinner className="h-8 w-8 mx-auto mb-4" />
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
						disabled={isLoading || (dnsLoadingProgress !== null)}
						variant="outline"
					>
						{isLoading || dnsLoadingProgress !== null ? (
							<Spinner className="mr-2 h-4 w-4" />
						) : (
							<RefreshCw className="mr-2 h-4 w-4" />
						)}
						Refresh Cache
					</Button>
					<AddDomainDialog title="Loading all domains across accounts can take up to 30 seconds for large accounts (100 domains ~ 30s)" accounts={accounts} onDomainCreated={handleDomainCreated} />

				</div>
			</div>

			{selectedCount > 0 && (
				<Card className="sticky top-0 z-10 bg-primary/10 border-primary/30 shadow-lg backdrop-blur-sm transition-all duration-200 animate-in slide-in-from-top-2">
					<CardContent className="py-4">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-3 flex-1 min-w-0">
								<div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 shrink-0">
									<CheckCircle2 className="h-4 w-4 text-primary" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-semibold text-primary">
											{selectedCount} domain{selectedCount > 1 ? 's' : ''} selected
										</span>
										{selectedZones.length > 0 && (
											<span className="text-xs text-muted-foreground hidden sm:inline">
												•
											</span>
										)}
										{selectedZones.length > 0 && (
											<div className="flex items-center gap-1.5 flex-wrap max-w-md">
												{selectedZones.slice(0, 3).map((zone) => (
													<span
														key={`${zone.accountId}-${zone.zone.id}`}
														className="text-xs font-mono bg-background/80 px-2 py-0.5 rounded border border-border/50 truncate max-w-[120px]"
														title={zone.zone.name}
													>
														{zone.zone.name}
													</span>
												))}
												{selectedZones.length > 3 && (
													<span className="text-xs text-muted-foreground">
														+{selectedZones.length - 3} more
													</span>
												)}
											</div>
										)}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2 flex-wrap">
								<BulkEditARecordDialog
									selectedZones={selectedZones}
									onComplete={() => clear()}
									onRefreshDNS={handleRefreshDNS}
								/>
								<BulkDeleteDomainsDialog
									selectedZones={selectedZones}
									onComplete={() => {
										clear();
										handleRefresh();
									}}
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={clear}
									className="gap-2"
								>
									<X className="h-3.5 w-3.5" />
									Clear
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

		{isLoading ? (
			<div className="flex items-center justify-center py-12">
				<Card className="w-full max-w-md">
					<CardContent className="py-10 px-6">
						<div className="text-center">
							<Spinner className="h-6 w-6 mx-auto mb-3 text-primary" />
							<h3 className="text-lg font-medium mb-2">Loading domains from all accounts...</h3>
							<p className="text-sm text-muted-foreground">
								This may take a moment if you have many domains
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
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
							onDomainDeleted={handleRefresh}
						/>
					</div>
				</Card>
			)}
		</div>
	);
}




