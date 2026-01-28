'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Search, RefreshCw, CheckCircle2, X, Copy, ShieldCheck, Network, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ColumnVisibilityMenu } from '@/components/table/column-visibility-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSelection } from '@/hooks/use-selection';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useDomainsData } from './hooks/use-domains-data';
import { useDomainsFilter } from './hooks/use-domains-filter';
import { useDomainsSort, type SortField, type SortDirection } from './hooks/use-domains-sort';
import { DomainsTable } from './components/domains-table';
import { CompactPagination } from './components/compact-pagination';
import { AddDomainDialog } from './components/add-domain-dialog';
import { BulkEditARecordDialog } from './components/bulk-edit-a-record-dialog';
import { BulkDeleteDomainsDialog } from './components/bulk-delete-domains-dialog';
import { AIBotsProtectionDialog } from './components/ai-bots-protection-dialog';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { toast } from 'sonner';
import { cn, createRateLimiter, copyToClipboard } from '@/lib/utils';
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
  const { enrichedZones, isLoading, isZonesLoading, isDnsLoading, isSSLLoading, loadZones, loadDNSForZone, refreshZonesOnly, refreshAllDNS, refreshAllSSL, accountsLoading, accounts } = useDomainsData();
  const { zones, isCacheValid, clearCache } = useCloudflareCache();
  const refreshToastId = useRef<string | number | null>(null);

  // Log cache info to console
  if (isCacheValid('zones') && zones.length > 0) {
    console.log(`Cache: ${enrichedZones.length} of ${zones.length} domains loaded`);
  }

  const [searchTerm, setSearchTerm] = useLocalStorage<string>('cloudflare-search-term', '');
  const [selectedAccount, setSelectedAccount] = useLocalStorage<string>('cloudflare-account-filter', 'all');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Pagination commented out - showing all rows
  // const [currentPage, setCurrentPage] = useState(1);
  // const [rowsPerPageMode, setRowsPerPageMode] = useState<'fill' | '50' | '100' | 'all'>('fill');
  // const [calculatedItemsPerPage, setCalculatedItemsPerPage] = useState(10);

  // Calculate items per page based on window height (only for "Fill" mode)
  // useEffect(() => {
  // 	const calculateItemsPerPage = () => {
  // 		const windowHeight = window.innerHeight;
  // 		// Estimate row height (53px) + header height (53px) + fixed elements
  // 		const availableHeight = windowHeight - 200; // Account for header, footer, and fixed pagination
  // 		const estimatedRowHeight = 53;
  // 		const calculatedItems = Math.max(5, Math.floor(availableHeight / estimatedRowHeight));
  // 		setCalculatedItemsPerPage(calculatedItems);
  // 	};

  // 	calculateItemsPerPage();
  // 	window.addEventListener('resize', calculateItemsPerPage);
  // 	return () => window.removeEventListener('resize', calculateItemsPerPage);
  // }, []);

  // const handlePageChange = useCallback((page: number) => {
  // 	setCurrentPage(page);
  // }, []);

  // const handleRowsPerPageChange = useCallback((mode: 'fill' | '50' | '100' | 'all') => {
  // 	setRowsPerPageMode(mode);
  // 	setCurrentPage(1); // Reset to first page when changing rows per page
  // }, []);

  // Debounce search term with 200ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [columnVisibility, setColumnVisibility] = useState<DomainColumnVisibility>(() =>
    loadDomainColumnVisibility()
  );
  const whoisRateLimiter = useMemo(
    () =>
      createRateLimiter({
        capacity: 10,
        refillAmount: 10,
        refillIntervalMs: 10_000,
      }),
    []
  );

  const filteredZones = useDomainsFilter(enrichedZones, debouncedSearchTerm, selectedAccount);
  const sortedZones = useDomainsSort(filteredZones, sortField, sortDirection);

  // Calculate domain counts per account
  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    enrichedZones.forEach((zone) => {
      counts[zone.accountId] = (counts[zone.accountId] || 0) + 1;
    });
    return counts;
  }, [enrichedZones]);

  // Pagination commented out - showing all rows
  // Compute itemsPerPage based on selected mode
  // const itemsPerPage = useMemo(() => {
  // 	switch (rowsPerPageMode) {
  // 		case 'fill':
  // 			return calculatedItemsPerPage;
  // 		case '50':
  // 			return 50;
  // 		case '100':
  // 			return 100;
  // 		case 'all':
  // 			return sortedZones.length || Infinity;
  // 		default:
  // 			return calculatedItemsPerPage;
  // 	}
  // }, [rowsPerPageMode, calculatedItemsPerPage, sortedZones.length]);

  // Reset to first page when zones change or search changes
  // useEffect(() => {
  // 	setCurrentPage(1);
  // }, [sortedZones.length, debouncedSearchTerm]);

  // Pagination helpers
  // const totalPages = rowsPerPageMode === 'all' ? 1 : Math.ceil(sortedZones.length / itemsPerPage);
  // const startIndex = rowsPerPageMode === 'all' ? 0 : (currentPage - 1) * itemsPerPage;
  // const paginatedZones = rowsPerPageMode === 'all' 
  // 	? sortedZones 
  // 	: sortedZones.slice(startIndex, startIndex + itemsPerPage);

  // Show all rows instead of paginated
  const paginatedZones = sortedZones;

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
    if (selectedAccount && selectedAccount !== 'all') {
      loadZones(true, selectedAccount);
    } else {
      clearCache();
      loadZones(true);
    }
  }, [clearCache, loadZones, selectedAccount]);

  const handleRefreshZones = useCallback(() => {
    if (selectedAccount && selectedAccount !== 'all') {
      refreshZonesOnly(selectedAccount);
    } else {
      refreshZonesOnly();
    }
  }, [refreshZonesOnly, selectedAccount]);

  const handleRefreshDNSAll = useCallback(() => {
    if (selectedAccount && selectedAccount !== 'all') {
      refreshAllDNS(selectedAccount);
    } else {
      refreshAllDNS();
    }
  }, [refreshAllDNS, selectedAccount]);

  const handleRefreshSSL = useCallback(() => {
    if (selectedAccount && selectedAccount !== 'all') {
      refreshAllSSL(selectedAccount);
    } else {
      refreshAllSSL();
    }
  }, [refreshAllSSL, selectedAccount]);

  const handleDomainDeleted = useCallback((zoneId: string, accountId: string) => {
    const { removeZone } = useCloudflareCache.getState();
    removeZone(zoneId, accountId);
  }, []);

  const handleDomainCreated = useCallback(() => {
    // Zones are already added reactively via addZone() in use-bulk-domain-creation
    // No need to reload - the cache updates automatically trigger table rerender
  }, []);

  const handleRefreshDNS = useCallback((zoneId: string, accountId: string) => {
    loadDNSForZone(zoneId, accountId);
  }, [loadDNSForZone]);

  const stats = useMemo(() => {
    const total = enrichedZones.length;
    const visible = sortedZones.length;
    const selected = selectedCount;
    const cloudflareAccountsCount = accounts.length;
    return { total, visible, selected, cloudflareAccountsCount };
  }, [enrichedZones.length, sortedZones.length, selectedCount, accounts.length]);

  const handleCopySelected = useCallback(async () => {
    if (selectedZones.length === 0) return;
    const domainsText = selectedZones.map((zone) => zone.zone.name).join('\n');
    await copyToClipboard(
      domainsText,
      `Copied ${selectedZones.length} domain${selectedZones.length > 1 ? 's' : ''}`,
      'Failed to copy selected domains'
    );
  }, [selectedZones]);

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
            <h3 className="text-lg font-medium mb-2">Loading Cloudflare Accounts...</h3>
            <p className="text-muted-foreground">
              Please wait while we load your Cloudflare accounts to display domains
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
            <h3 className="text-lg font-medium mb-2">No Cloudflare Credentials Found</h3>
            <p className="text-muted-foreground mb-4">
              You need at least one Cloudflare credential to view domains. Add or configure your Cloudflare credentials in the Credentials section.
            </p>
            <Button onClick={() => router.push('/credentials')}>
              Manage Credentials
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
            <h1 className="text-xl font-bold">Cloudflare</h1>
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
                <span className="text-foreground font-semibold">{stats.cloudflareAccountsCount}</span>
                <span className="text-muted-foreground ml-1">Cloudflare account{stats.cloudflareAccountsCount !== 1 ? 's' : ''}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-nowrap">

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search domains, IPs, Cloudflare accounts"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 w-96"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-xsh-9">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">
                  All Accounts <span className="text-muted-foreground ml-1">({enrichedZones.length})</span>
                </SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name || account.email}
                    <span className="text-muted-foreground ml-2">
                      ({domainCounts[account.id] || 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">

              <ButtonGroup className="flex">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="px-2"
                      >
                        All
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh zones, DNS & SSL</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleRefreshDNSAll}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="px-2"
                      >
                        <Network className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh DNS records</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleRefreshSSL}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="px-2"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh SSL settings</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleRefreshZones}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="px-2"
                      >
                        <Globe className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh zones only</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </ButtonGroup>

            </div>
            <ColumnVisibilityMenu items={columnVisibilityItems} />
            <AddDomainDialog title="Adding domains to Cloudflare accounts - this may take a few moments for large accounts" accounts={accounts} onDomainCreated={handleDomainCreated} />
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
                <AIBotsProtectionDialog
                  selectedZones={selectedZones}
                  onComplete={() => clear()}
                  trigger={
                    <Button size="sm" variant="outline" className="gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      AI Bots
                    </Button>
                  }
                />
                <BulkDeleteDomainsDialog
                  selectedZones={selectedZones}
                  onComplete={() => {
                    clear();
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { void handleCopySelected(); }}
                  className="gap-2"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy selected
                </Button>
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
                <h3 className="text-lg font-medium mb-2">Loading domains from Cloudflare accounts...</h3>
                <p className="text-sm text-muted-foreground">
                  This may take a moment if you have many domains across your Cloudflare accounts
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
                ? 'Try adjusting your search terms or check your Cloudflare account permissions'
                : 'No domains found in your Cloudflare accounts. Make sure your accounts have active zones.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-0">
          <div className="overflow-x-auto">
            <DomainsTable
              zones={paginatedZones}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              isSelected={isSelected}
              onToggle={toggleOne}
              onToggleAll={toggleAll}
              allSelected={allSelected}
              selectedCount={selectedCount}
              onRefreshDNS={handleRefreshDNS}
              onDomainDeleted={handleDomainDeleted}
              visibleColumns={columnVisibility}
            />
          </div>
        </Card>
      )}

      {/* Pagination commented out - showing all rows */}
      {/* <CompactPagination
				currentPage={currentPage}
				totalPages={totalPages}
				totalItems={sortedZones.length}
				itemsPerPage={itemsPerPage}
				rowsPerPageMode={rowsPerPageMode}
				onPageChange={handlePageChange}
				onRowsPerPageChange={handleRowsPerPageChange}
			/> */}
    </div>
  );
}




