import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import type { NamecheapAccount } from '@/types/namecheap';
import type { ProxyAccount } from '@/types/cloudflare';

interface UseNameserversReturn {
    fetchNameservers: (domain: string, accountId: string, forceRefresh?: boolean) => Promise<{ nameservers: string[], isUsingOurDNS: boolean } | null>;
    setNameservers: (domains: string[], nameservers: string[], accountId: string) => Promise<boolean>;
    loadingStates: Record<string, boolean>;
}

interface NameserversAccount {
    id: string;
    apiUser: string;
    apiKey: string;
    proxyId?: string;
}

export function useNameservers(
    accounts: NamecheapAccount[],
    proxyAccounts: ProxyAccount[]
): UseNameserversReturn {
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const { setNameserversCache, getNameserversCache } = useCloudflareCache();

    /**
     * Parse domain into SLD and TLD
     */
    const parseDomain = useCallback((domain: string): { sld: string, tld: string } | null => {
        const parts = domain.split('.');
        if (parts.length < 2) {
            return null;
        }
        const tld = parts[parts.length - 1];
        const sld = parts.slice(0, -1).join('.');
        return { sld, tld };
    }, []);

    /**
     * Build headers for API request
     */
    const buildHeaders = useCallback((account: NameserversAccount, proxy: ProxyAccount): Record<string, string> => {
        const headers: Record<string, string> = {
            'x-account-id': account.id,
            'x-api-user': account.apiUser,
            'x-api-key': account.apiKey,
            'x-proxy-host': proxy.host,
        };

        if (proxy.port) headers['x-proxy-port'] = proxy.port.toString();
        if (proxy.username) headers['x-proxy-username'] = proxy.username;
        if (proxy.password) headers['x-proxy-password'] = proxy.password;

        return headers;
    }, []);

    /**
     * Fetch nameservers for a single domain
     */
    const fetchNameservers = useCallback(async (
        domain: string,
        accountId: string,
        forceRefresh = false
    ): Promise<{ nameservers: string[], isUsingOurDNS: boolean } | null> => {
        // Check cache first (unless forced)
        if (!forceRefresh) {
            const cached = getNameserversCache(domain);
            if (cached) {
                return { nameservers: cached.nameservers, isUsingOurDNS: cached.isUsingOurDNS };
            }
        }

        const account = accounts.find((a) => a.id === accountId);
        if (!account) {
            toast.error(`Account not found for domain ${domain}`);
            return null;
        }

        if (!account.proxyId) {
            toast.error(`Proxy missing for account ${account.name || account.email}`);
            return null;
        }

        const proxy = proxyAccounts.find((p) => p.id === account.proxyId);
        if (!proxy) {
            toast.error(`Proxy not found for account ${account.name || account.email}`);
            return null;
        }

        const parsed = parseDomain(domain);
        if (!parsed) {
            toast.error(`Invalid domain format: ${domain}`);
            return null;
        }

        setLoadingStates((prev) => ({ ...prev, [domain]: true }));

        try {
            const headers = buildHeaders(account, proxy);
            const response = await fetch(`/api/namecheap/nameservers?sld=${parsed.sld}&tld=${parsed.tld}`, {
                method: 'GET',
                headers,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to fetch nameservers');
            }

            const { nameservers, isUsingOurDNS } = data.data;

            // Cache the result
            setNameserversCache(domain, nameservers, isUsingOurDNS);

            return { nameservers, isUsingOurDNS };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Failed to fetch nameservers for ${domain}: ${errorMessage}`);
            return null;
        } finally {
            setLoadingStates((prev) => ({ ...prev, [domain]: false }));
        }
    }, [accounts, proxyAccounts, parseDomain, buildHeaders, getNameserversCache, setNameserversCache]);

    /**
     * Set nameservers for multiple domains
     */
    const setNameservers = useCallback(async (
        domains: string[],
        nameservers: string[],
        accountId: string
    ): Promise<boolean> => {
        const account = accounts.find((a) => a.id === accountId);
        if (!account) {
            toast.error('Account not found');
            return false;
        }

        if (!account.proxyId) {
            toast.error(`Proxy missing for account ${account.name || account.email}`);
            return false;
        }

        const proxy = proxyAccounts.find((p) => p.id === account.proxyId);
        if (!proxy) {
            toast.error(`Proxy not found for account ${account.name || account.email}`);
            return false;
        }

        const headers = buildHeaders(account, proxy);

        // Process each domain
        const results = await Promise.allSettled(
            domains.map(async (domain) => {
                const parsed = parseDomain(domain);
                if (!parsed) {
                    throw new Error(`Invalid domain format: ${domain}`);
                }

                setLoadingStates((prev) => ({ ...prev, [domain]: true }));

                try {
                    const response = await fetch('/api/namecheap/nameservers', {
                        method: 'POST',
                        headers: {
                            ...headers,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            sld: parsed.sld,
                            tld: parsed.tld,
                            nameservers,
                        }),
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        throw new Error(data.error || 'Failed to set nameservers');
                    }

                    // Update cache
                    setNameserversCache(domain, nameservers, false); // Custom NS means not using Namecheap DNS

                    return { domain, success: true };
                } catch (error) {
                    throw new Error(`${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                } finally {
                    setLoadingStates((prev) => ({ ...prev, [domain]: false }));
                }
            })
        );

        // Count successes and failures
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        if (failures.length === 0) {
            toast.success(`Nameservers updated for ${successes.length} domain${successes.length > 1 ? 's' : ''}`);
            return true;
        } else if (successes.length === 0) {
            toast.error(`Failed to update nameservers for all ${domains.length} domains`);
            failures.forEach((f) => {
                if (f.status === 'rejected') {
                    toast.error(f.reason.message);
                }
            });
            return false;
        } else {
            toast.warning(`Updated ${successes.length} domain(s), failed ${failures.length}`);
            failures.forEach((f) => {
                if (f.status === 'rejected') {
                    toast.error(f.reason.message);
                }
            });
            return true;
        }
    }, [accounts, proxyAccounts, parseDomain, buildHeaders, setNameserversCache]);

    return {
        fetchNameservers,
        setNameservers,
        loadingStates,
    };
}
