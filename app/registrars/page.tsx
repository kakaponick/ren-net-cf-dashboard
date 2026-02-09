'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useSelection } from '@/hooks/use-selection';
import { useRegistrars } from '@/hooks/use-registrars';
import { useAccountStore } from '@/store/account-store';
import { copyToClipboard } from '@/lib/utils';
import { RegistrarDomainsTable } from '@/views/registrars/components/registrar-domains-table';
import type { UnifiedDomain } from '@/types/registrar';
import { RegistrarPageHeader } from '@/views/registrars/components/registrar-page-header';
import { SelectionToolbar } from '@/views/registrars/components/selection-toolbar';
import { Globe, RefreshCw } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { useRegistrarFilterSort } from '@/views/registrars/hooks/use-registrar-filter-sort';
import { useLoadingToast } from '@/views/registrars/hooks/use-loading-toast';
import { useNameservers } from '@/hooks/use-nameservers';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { SetNameserversDialog } from '@/views/registrars/components/set-nameservers-dialog';
import {
  loadRegistrarColumnVisibility,
  saveRegistrarColumnVisibility,
  REGISTRAR_COLUMN_KEYS,
  REGISTRAR_COLUMN_LABELS,
  type RegistrarColumnKey,
  type RegistrarColumnVisibility
} from '@/views/registrars/registrar-columns';

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

  // Initialize nameservers hook
  const { accounts, proxyAccounts } = useAccountStore();
  const { fetchNameservers, setNameservers, loadingStates: nsLoadingStates } = useNameservers(
    namecheapAccounts,
    proxyAccounts,
    njallaAccounts
  );
  const { nameservers: nameserversCache } = useCloudflareCache();

  // State for editing single domain
  const [editingDomain, setEditingDomain] = useState<UnifiedDomain | null>(null);

  const accountEmails = useMemo(() => {
    const emails: Record<string, string> = {};
    namecheapAccounts.forEach(acc => emails[acc.id] = acc.email);
    njallaAccounts.forEach(acc => emails[acc.id] = acc.email);
    return emails;
  }, [namecheapAccounts, njallaAccounts]);

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
  } = useRegistrarFilterSort(domains, accountEmails);

  const [columnVisibility, setColumnVisibility] = useState<RegistrarColumnVisibility>(() =>
    loadRegistrarColumnVisibility()
  );

  useEffect(() => {
    saveRegistrarColumnVisibility(columnVisibility);
  }, [columnVisibility]);

  const handleToggleColumn = useCallback((column: RegistrarColumnKey, isVisible: boolean) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [column]: isVisible
    }));
  }, []);

  const columnVisibilityItems = useMemo(
    () =>
      REGISTRAR_COLUMN_KEYS.map((column) => ({
        id: column,
        label: REGISTRAR_COLUMN_LABELS[column],
        isVisible: columnVisibility[column],
        onToggle: (isVisible: boolean) => handleToggleColumn(column, isVisible)
      })),
    [columnVisibility, handleToggleColumn]
  );

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

  const handleRefreshDomains = () => {
    if (selectedAccount && selectedAccount !== 'all') {
      refreshAccount(selectedAccount);
    } else {
      loadDomains(true);
    }
  };

  const handleRefresh = () => {
    handleRefreshDomains();
    // Also refresh nameservers for visible domains
    handleRefreshNameservers();
  };

  const handleRefreshNameservers = () => {
    // Fetch nameservers for all visible domains (Namecheap and Njalla)
    const registrarsWithNameservers = ['namecheap', 'njalla'];
    const domainsToUpdate = sortedDomains.filter(d => registrarsWithNameservers.includes(d.registrar));

    domainsToUpdate.forEach(domain => {
      if (domain.accountId) {
        void fetchNameservers(domain.name, domain.accountId, true);
      }
    });
  };

  const handleRefreshSingleNameserver = (domain: string) => {
    // Find the account for this domain
    const selectedDomain = domains.find((d) => d.name === domain);
    if (selectedDomain?.accountId) {
      void fetchNameservers(domain, selectedDomain.accountId, true);
    }
  };

  const handleSetNameservers = async (domainNames: string[], nameservers: string[]) => {
    // Get account ID from first domain
    const firstDomain = domains.find((d) => domainNames.includes(d.name));
    if (!firstDomain?.accountId) {
      return false;
    }
    return await setNameservers(domainNames, nameservers, firstDomain.accountId);
  };

  const handleEditNameservers = (domain: UnifiedDomain) => {
    setEditingDomain(domain);

    // Auto-fetch nameservers if not already cached
    const cached = nameserversCache[domain.name];
    if (!cached && !nsLoadingStates[domain.name]) {
      void fetchNameservers(domain.name, domain.accountId);
    }
  };

  useLoadingToast(isRefreshing, 'Loading domains...');
  useLoadingToast(isLoading, 'Loading domains...');

  const isNameserversLoading = useMemo(() => Object.values(nsLoadingStates).some(Boolean), [nsLoadingStates]);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <RegistrarPageHeader
        stats={stats}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClearSearch={clearSearch}
        onRefresh={handleRefresh}
        onRefreshDomains={handleRefreshDomains}
        onRefreshNameservers={handleRefreshNameservers}
        isRefreshing={isRefreshing}
        isNameserversLoading={isNameserversLoading}
        namecheapAccounts={namecheapAccounts}
        njallaAccounts={njallaAccounts}
        selectedAccount={selectedAccount}
        onAccountChange={handleAccountChange}
        selectedRegistrar={selectedRegistrar}
        onRegistrarChange={setSelectedRegistrar}
        domainCounts={domainCounts}
        columnVisibilityItems={columnVisibilityItems}
      />

      {/* Main content */}
      <SelectionToolbar
        selectedCount={selectedCount}
        selectedDomains={selectedDomains}
        onCopySelected={() => void handleCopySelected()}
        onClearSelection={clear}
        onSetNameservers={handleSetNameservers}
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
              nameserversCache={nameserversCache}
              nameserversLoading={nsLoadingStates}
              onRefreshNameservers={handleRefreshSingleNameserver}
              onEditNameservers={handleEditNameservers}
              visibleColumns={columnVisibility}
              accountEmails={accountEmails}
            />
          </div>
        </Card>
      )}

      {editingDomain && (
        <SetNameserversDialog
          key={editingDomain.id}
          selectedDomains={[editingDomain]}
          onSetNameservers={async (domains, ns) => {
            const result = await handleSetNameservers(domains, ns);
            if (result) setEditingDomain(null);
            return result;
          }}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingDomain(null);
          }}
          currentNameservers={nameserversCache[editingDomain.name]?.nameservers || null}
          isLoadingNameservers={nsLoadingStates[editingDomain.name] || false}
        />
      )}

    </div>
  )
}