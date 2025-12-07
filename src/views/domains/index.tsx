'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Search, RefreshCw, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { ColumnVisibilityMenu } from '@/components/table/column-visibility-menu';
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
import { useDomainHealthStore } from '@/store/domain-health-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
	DEFAULT_DOMAIN_COLUMN_VISIBILITY,
	DOMAIN_COLUMN_KEYS,
	DOMAIN_COLUMN_LABELS,
	type DomainColumnKey,
	type DomainColumnVisibility,
	loadDomainColumnVisibility,
	saveDomainColumnVisibility
} from './domain-columns';

export default function DomainsPage() {
	const router = useRouter();
	const { enrichedZones, isLoading, isZonesLoading, loadZones, loadDNSForZone, accountsLoading, accounts } = useDomainsData();
	const { zones, isCacheValid, clearCache } = useCloudflareCache();
	const refreshToastId = useRef<string | number | null>(null);

	// Log cache info to console
	if (isCacheValid('zones') && zones.length > 0) {
		console.log(`Cache: ${enrichedZones.length} of ${zones.length} domains loaded`);
	}

	const [searchTerm, setSearchTerm] = useState('');
	const [sortField, setSortField] = useState<SortField>('name');
	const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
	const [columnVisibility, setColumnVisibility] = useState<DomainColumnVisibility>(() =>
		loadDomainColumnVisibility()
	);
	const [isHealthRefreshing, setIsHealthRefreshing] = useState(false);

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

	const handleToggleColumn = useCallback((column: DomainColumnKey, isVisible: boolean) => {
		setColumnVisibility((prev) => ({
			...prev,
			[column]: isVisible
		}));
	}, []);

	const columnVisibilityItems = useMemo(
		() =>
			DOMAIN_COLUMN_KEYS.map((column) => ({
				id: column,
				label: DOMAIN_COLUMN_LABELS[column],
				isVisible: columnVisibility[column],
				onToggle: (isVisible: boolean) => handleToggleColumn(column, isVisible)
			})),
		[columnVisibility, handleToggleColumn]
	);

	const handleRefresh = useCallback(() => {
		clearCache();
		loadZones(true);
	}, [clearCache, loadZones]);

	const handleDomainCreated = useCallback(() => {
		// Zones are already added reactively via addZone() in use-bulk-domain-creation
		// No need to reload - the cache updates automatically trigger table rerender
	}, []);

	const handleRefreshHealthAll = useCallback(async () => {
		if (sortedZones.length === 0) {
			toast.info('No domains to refresh');
			return;
		}

		// Clear cached health so UI shows empty state immediately
		useDomainHealthStore.getState().clearAll();

		setIsHealthRefreshing(true);
		const toastId = toast.loading('Refreshing health for all domains...');
		const { setHealthResult, setHealthError } = useDomainHealthStore.getState();

		const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
		const rateLimitDelayMs = 1200; // 10 req / 10s => ~1 req/s (small cushion)

		try {
			for (let i = 0; i < sortedZones.length; i++) {
				const zone = sortedZones[i];
				try {
					const response = await fetch(`/api/domain-health?domain=${encodeURIComponent(zone.zone.name)}`);
					const data = await response.json();

					if (!response.ok) {
						throw new Error(data?.error || 'Health check failed');
					}

					setHealthResult(zone.zone.name, data);
					setHealthError(zone.zone.name, '');
				} catch (err) {
					const message = err instanceof Error ? err.message : 'Health check failed';
					setHealthError(zone.zone.name, message);
				}

				// Respect RDAP rate limits (10 req / 10s) when processing large batches
				if (i < sortedZones.length - 1) {
					await wait(rateLimitDelayMs);
				}
			}

			toast.success('Health refreshed for all domains');
		} finally {
			toast.dismiss(toastId);
			setIsHealthRefreshing(false);
		}
	}, [sortedZones]);

	const handleRefreshDNS = useCallback((zoneId: string, accountId: string) => {
		loadDNSForZone(zoneId, accountId);
	}, [loadDNSForZone]);

	const stats = useMemo(() => {
		const total = enrichedZones.length;
		const visible = sortedZones.length;
		const selected = selectedCount;
		const accountsCount = accounts.length;
		return { total, visible, selected, accountsCount };
	}, [enrichedZones.length, sortedZones.length, selectedCount, accounts.length]);

	useEffect(() => {
		if (isZonesLoading && !refreshToastId.current) {
			refreshToastId.current = toast.loading('Refreshing domain cache...');
		} else if (!isZonesLoading && refreshToastId.current) {
			toast.dismiss(refreshToastId.current);
			refreshToastId.current = null;
		}
	}, [isZonesLoading]);

	useEffect(() => {
		saveDomainColumnVisibility(columnVisibility);
	}, [columnVisibility]);

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
			<div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-3 -mx-6 px-6">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<h1 className="text-xl font-bold">Domains</h1>
						<div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
							<span className="px-2 py-0.5 bg-muted/50 rounded border border-border/50">
								<span className="text-foreground font-semibold">{stats.visible}</span>
								{stats.visible !== stats.total && stats.total > 0 && (
									<>
										<span className="text-muted-foreground">/</span>
										<span>{stats.total}</span>
									</>
								)}
								<span className="text-muted-foreground ml-1">domains</span>
							</span>
							{stats.selected > 0 && (
								<span className="px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
									<span className="font-semibold">{stats.selected}</span>
									<span className="text-muted-foreground ml-1">selected</span>
								</span>
							)}
							<span className="px-2 py-0.5 bg-muted/50 rounded border border-border/50">
								<span className="text-foreground font-semibold">{stats.accountsCount}</span>
								<span className="text-muted-foreground ml-1">account{stats.accountsCount !== 1 ? 's' : ''}</span>
							</span>
						</div>
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

						<div className="flex items-center gap-2">
							<div className="flex items-center gap-3 rounded-md border p-1 pl-3 text-muted-foreground">
							<RefreshCw className={cn(isLoading || isHealthRefreshing ? 'animate-spin' : '', 'h-4 w-4')} />
								<span className="text-xs font-medium">Refresh cache</span>
							
							<ButtonGroup className="flex">
								<Button
									onClick={handleRefresh}
									disabled={isLoading}
									variant="outline"
									size="sm"
								>
									Cloudflare
								</Button>
								<Button
									onClick={() => { void handleRefreshHealthAll(); }}
									disabled={isHealthRefreshing || isLoading}
									variant="outline"
									size="sm"
								>
									Health status
								</Button>
							</ButtonGroup>
							</div>
						</div>
						<ColumnVisibilityMenu items={columnVisibilityItems} />
						<AddDomainDialog title="Loading all domains across accounts can take up to 30 seconds for large accounts (100 domains ~ 30s)" accounts={accounts} onDomainCreated={handleDomainCreated} />
					</div>
				</div>
			</div>

			{selectedCount > 0 && (
				<Card className="sticky top-[60px] z-10 bg-primary/10 border-primary/30 shadow-lg backdrop-blur-sm transition-all duration-200 animate-in slide-in-from-top-2">
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

		{isZonesLoading ? (
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
							visibleColumns={columnVisibility}
						/>
					</div>
				</Card>
			)}
		</div>
	);
}




