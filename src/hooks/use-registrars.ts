import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import type { NamecheapDomain, NamecheapAccount } from '@/types/namecheap';
import type { NjallaDomain, NjallaAccount } from '@/types/njalla';
import type { UnifiedDomain } from '@/types/registrar';
import { toUnifiedDomain, toUnifiedDomainFromNjalla } from '@/types/registrar';
import type { ProxyAccount } from '@/types/cloudflare';
import { processInParallel } from '@/lib/utils';

interface UseRegistrarsReturn {
  domains: UnifiedDomain[];
  isLoading: boolean;
  isRefreshing: boolean;
  namecheapAccounts: NamecheapAccount[];
  njallaAccounts: NjallaAccount[];
  loadDomains: (force?: boolean) => Promise<void>;
  refreshAccount: (accountId: string) => Promise<void>;
}

interface FetchResult {
  accountId: string;
  registrar: 'namecheap' | 'njalla';
  domains: UnifiedDomain[];
  error?: string;
}

export function useRegistrars(): UseRegistrarsReturn {
  const [domains, setDomains] = useState<UnifiedDomain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { accounts, proxyAccounts } = useAccountStore();
  const { getNamecheapDomains, setNamecheapDomains, getNjallaDomains, setNjallaDomains, isCacheValid, _hasHydrated } =
    useCloudflareCache();

  // Derive Namecheap accounts from the main account store
  const namecheapAccounts = useMemo(() => {
    return accounts
      .filter((account) => account.category === 'registrar' && account.registrarName === 'namecheap')
      .map((account) => {
        const defaultApiUser = account.email.split('@')[0].replaceAll('.', '');
        const apiUser = account.username || defaultApiUser;

        return {
          id: account.id,
          name: account.name || account.email || 'Unnamed Account',
          email: account.email,
          apiUser,
          apiKey: account.apiToken,
          proxyId: account.proxyId,
          createdAt: account.createdAt,
        } as NamecheapAccount;
      });
  }, [accounts]);

  // Derive Njalla accounts from the main account store
  const njallaAccounts = useMemo(() => {
    return accounts
      .filter((account) => account.category === 'registrar' && account.registrarName === 'njalla')
      .map((account) => ({
        id: account.id,
        name: account.name || account.email || 'Unnamed Account',
        email: account.email,
        apiKey: account.apiToken,
        createdAt: account.createdAt,
      } as NjallaAccount));
  }, [accounts]);

  // Load cached domains on mount or when hydration completes
  useEffect(() => {
    if (!_hasHydrated) return;

    const cachedDomains: UnifiedDomain[] = [];
    let hasCache = false;

    // Load cached Namecheap domains
    for (const account of namecheapAccounts) {
      if (isCacheValid('namecheapDomains', account.id)) {
        const data = getNamecheapDomains(account.id);
        if (data?.domains && Array.isArray(data.domains)) {
          const unifiedDomains = data.domains.map((d) => toUnifiedDomain({ ...d, accountId: account.id }, account.id));
          cachedDomains.push(...unifiedDomains);
          hasCache = true;
        }
      }
    }

    // Load cached Njalla domains
    for (const account of njallaAccounts) {
      if (isCacheValid('njallaDomains', account.id)) {
        const data = getNjallaDomains(account.id);
        if (data?.domains && Array.isArray(data.domains)) {
          const unifiedDomains = data.domains.map((d) => toUnifiedDomainFromNjalla({ ...d, accountId: account.id }, account.id));
          cachedDomains.push(...unifiedDomains);
          hasCache = true;
        }
      }
    }

    if (hasCache) {
      setDomains(cachedDomains);
    }
  }, [namecheapAccounts, njallaAccounts, getNamecheapDomains, getNjallaDomains, isCacheValid, _hasHydrated]);

  /**
   * Fetches domains for a single Namecheap account.
   */
  const fetchNamecheapAccountDomains = useCallback(
    async (account: NamecheapAccount): Promise<FetchResult> => {
      if (!account.proxyId) {
        return {
          accountId: account.id,
          registrar: 'namecheap',
          domains: [],
          error: `Proxy missing for account ${account.name}`,
        };
      }

      const proxy = proxyAccounts.find((p) => p.id === account.proxyId);
      if (!proxy) {
        return {
          accountId: account.id,
          registrar: 'namecheap',
          domains: [],
          error: `Proxy with ID ${account.proxyId} not found for account ${account.name}`,
        };
      }

      const proxyHeaders: Record<string, string> = {
        'x-proxy-host': proxy.host,
        'x-proxy-port': proxy.port?.toString() || '',
      };
      if (proxy.username) proxyHeaders['x-proxy-username'] = proxy.username;
      if (proxy.password) proxyHeaders['x-proxy-password'] = proxy.password;

      const headers: Record<string, string> = {
        'x-account-id': account.id,
        'x-api-user': account.apiUser,
        'x-api-key': account.apiKey,
        ...proxyHeaders,
      };

      try {
        const response = await fetch('/api/namecheap/domains', {
          method: 'GET',
          headers,
        });

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error(`JSON Parse error for ${account.name}`, jsonError);
          return {
            accountId: account.id,
            registrar: 'namecheap',
            domains: [],
            error: `Invalid JSON response for ${account.name}`,
          };
        }

        if (!response.ok) {
          return {
            accountId: account.id,
            registrar: 'namecheap',
            domains: [],
            error: data.error || `Failed to load domains for ${account.name}`,
          };
        }

        if (data.success && data.data && Array.isArray(data.data.domains)) {
          setNamecheapDomains(account.id, account.name || account.email, data.data.domains);
          const unifiedDomains = data.data.domains.map((d: NamecheapDomain) =>
            toUnifiedDomain({ ...d, accountId: account.id }, account.id)
          );
          return {
            accountId: account.id,
            registrar: 'namecheap',
            domains: unifiedDomains,
          };
        } else {
          return {
            accountId: account.id,
            registrar: 'namecheap',
            domains: [],
          };
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown network error';
        console.error(`Network error for ${account.name}:`, error);
        return {
          accountId: account.id,
          registrar: 'namecheap',
          domains: [],
          error: errMsg,
        };
      }
    },
    [proxyAccounts, setNamecheapDomains]
  );

  /**
   * Fetches domains for a single Njalla account.
   */
  const fetchNjallaAccountDomains = useCallback(
    async (account: NjallaAccount): Promise<FetchResult> => {
      try {
        const response = await fetch('/api/njalla/domains', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-njalla-key': account.apiKey,
            'x-account-id': account.id,
          },
          body: JSON.stringify({
            method: 'list-domains',
            params: {},
          }),
        });

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error(`JSON Parse error for ${account.name}`, jsonError);
          return {
            accountId: account.id,
            registrar: 'njalla',
            domains: [],
            error: `Invalid JSON response for ${account.name}`,
          };
        }

        if (!response.ok) {
          return {
            accountId: account.id,
            registrar: 'njalla',
            domains: [],
            error: data.error || `Failed to load domains for ${account.name}`,
          };
        }

        if (data.result && Array.isArray(data.result.domains)) {
          const njallaDomains: NjallaDomain[] = data.result.domains.map((d: any) => ({
            name: d.name,
            status: d.status,
            expiry: d.expiry,
            autorenew: d.autorenew,
            registrar: 'njalla' as const,
            accountId: account.id,
          }));

          setNjallaDomains(account.id, account.name || account.email, njallaDomains);
          const unifiedDomains = njallaDomains.map((d) => toUnifiedDomainFromNjalla(d, account.id));
          return {
            accountId: account.id,
            registrar: 'njalla',
            domains: unifiedDomains,
          };
        } else {
          return {
            accountId: account.id,
            registrar: 'njalla',
            domains: [],
          };
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown network error';
        console.error(`Network error for ${account.name}:`, error);
        return {
          accountId: account.id,
          registrar: 'njalla',
          domains: [],
          error: errMsg,
        };
      }
    },
    [setNjallaDomains]
  );

  const loadDomains = useCallback(
    async (force = false) => {
      if (namecheapAccounts.length === 0 && njallaAccounts.length === 0) {
        setDomains([]);
        return;
      }

      const setLoadingState = domains.length > 0 || force ? setIsRefreshing : setIsLoading;
      setLoadingState(true);

      try {
        const namecheapResults = await processInParallel(
          namecheapAccounts,
          fetchNamecheapAccountDomains,
          3 // Limit concurrency
        );
        const njallaResults = await processInParallel(
          njallaAccounts,
          fetchNjallaAccountDomains,
          3 // Limit concurrency
        );
        const results = [...namecheapResults, ...njallaResults];

        const allDomains: UnifiedDomain[] = [];
        const errors: string[] = [];

        for (const result of results) {
          if (result.error) {
            errors.push(result.error);
          }
          if (result.domains.length > 0) {
            allDomains.push(...result.domains);
          }
        }

        setDomains(allDomains);

        if (errors.length > 0) {
          const uniqueErrors = Array.from(new Set(errors));
          if (uniqueErrors.length > 3) {
            toast.error(`Failed to load domains for ${uniqueErrors.length} accounts`);
          } else {
            uniqueErrors.forEach((err) => toast.error(err));
          }
        }
      } catch (error) {
        console.error('Unexpected error in loadDomains:', error);
        toast.error('An unexpected error occurred while loading domains');
      } finally {
        setLoadingState(false);
      }
    },
    [namecheapAccounts, njallaAccounts, fetchNamecheapAccountDomains, fetchNjallaAccountDomains, domains.length]
  );

  const refreshAccount = useCallback(
    async (accountId: string) => {
      const namecheapAccount = namecheapAccounts.find((a) => a.id === accountId);
      const njallaAccount = njallaAccounts.find((a) => a.id === accountId);

      if (!namecheapAccount && !njallaAccount) return;

      setIsRefreshing(true);
      try {
        let result: FetchResult;

        if (namecheapAccount) {
          result = await fetchNamecheapAccountDomains(namecheapAccount);
        } else {
          result = await fetchNjallaAccountDomains(njallaAccount!);
        }

        if (result.error) {
          toast.error(result.error);
        } else if (result.domains.length > 0) {
          setDomains((prev) => {
            const filtered = prev.filter((d) => d.accountId !== accountId);
            return [...filtered, ...result.domains];
          });
          toast.success(`Loaded ${result.domains.length} domains for ${namecheapAccount?.name || njallaAccount?.name}`);
        } else {
          setDomains((prev) => prev.filter((d) => d.accountId !== accountId));
          toast.info(`No domains found for ${namecheapAccount?.name || njallaAccount?.name}`);
        }
      } catch (error) {
        console.error('Error refreshing account:', error);
        toast.error('Failed to refresh account domains');
      } finally {
        setIsRefreshing(false);
      }
    },
    [namecheapAccounts, njallaAccounts, fetchNamecheapAccountDomains, fetchNjallaAccountDomains]
  );

  return {
    domains,
    isLoading,
    isRefreshing,
    namecheapAccounts,
    njallaAccounts,
    loadDomains,
    refreshAccount,
  };
}
