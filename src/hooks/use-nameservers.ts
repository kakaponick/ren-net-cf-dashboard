import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import type { NamecheapAccount } from '@/types/namecheap';
import type { NjallaAccount } from '@/types/njalla';
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
    proxyAccounts: ProxyAccount[],
    njallaAccounts: NjallaAccount[] = []
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

        const namecheapAccount = accounts.find((a) => a.id === accountId);
        const njallaAccount = njallaAccounts.find((a) => a.id === accountId);

        if (!namecheapAccount && !njallaAccount) {
            toast.error(`Account not found for domain ${domain}`);
            return null;
        }

        setLoadingStates((prev) => ({ ...prev, [domain]: true }));

        try {
            let nameservers: string[] = [];
            let isUsingOurDNS = false;

            if (namecheapAccount) {
                if (!namecheapAccount.proxyId) {
                    throw new Error(`Proxy missing for account ${namecheapAccount.name || namecheapAccount.email}`);
                }

                const proxy = proxyAccounts.find((p) => p.id === namecheapAccount.proxyId);
                if (!proxy) {
                    throw new Error(`Proxy not found for account ${namecheapAccount.name || namecheapAccount.email}`);
                }

                const parsed = parseDomain(domain);
                if (!parsed) {
                    throw new Error(`Invalid domain format: ${domain}`);
                }

                const headers = buildHeaders(namecheapAccount, proxy);
                const response = await fetch(`/api/namecheap/nameservers?sld=${parsed.sld}&tld=${parsed.tld}`, {
                    method: 'GET',
                    headers,
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to fetch nameservers');
                }

                nameservers = data.data.nameservers;
                isUsingOurDNS = data.data.isUsingOurDNS;
            } else if (njallaAccount) {
                const response = await fetch(`/api/njalla/nameservers?domain=${domain}`, {
                    method: 'GET',
                    headers: {
                        'x-api-key': njallaAccount.apiKey
                    }
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to fetch nameservers');
                }

                nameservers = data.data.nameservers;
                isUsingOurDNS = data.data.isUsingOurDNS;
            }

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
    }, [accounts, proxyAccounts, njallaAccounts, parseDomain, buildHeaders, getNameserversCache, setNameserversCache]);

    /**
     * Set nameservers for multiple domains
     */
    const setNameservers = useCallback(async (
        domains: string[],
        nameservers: string[],
        accountId: string
    ): Promise<boolean> => {
        const namecheapAccount = accounts.find((a) => a.id === accountId);
        const njallaAccount = njallaAccounts.find((a) => a.id === accountId);

        if (!namecheapAccount && !njallaAccount) {
            toast.error('Account not found');
            return false;
        }

        const headers: Record<string, string> = {};
        let isNamecheap = false;

        if (namecheapAccount) {
            if (!namecheapAccount.proxyId) {
                toast.error(`Proxy missing for account ${namecheapAccount.name || namecheapAccount.email}`);
                return false;
            }

            const proxy = proxyAccounts.find((p) => p.id === namecheapAccount.proxyId);
            if (!proxy) {
                toast.error(`Proxy not found for account ${namecheapAccount.name || namecheapAccount.email}`);
                return false;
            }

            Object.assign(headers, buildHeaders(namecheapAccount, proxy));
            isNamecheap = true;
        } else if (njallaAccount) {
            headers['x-api-key'] = njallaAccount.apiKey;
        }

        // Process each domain
        const results = await Promise.allSettled(
            domains.map(async (domain) => {
                setLoadingStates((prev) => ({ ...prev, [domain]: true }));

                try {
                    let response;
                    if (isNamecheap) {
                        const parsed = parseDomain(domain);
                        if (!parsed) {
                            throw new Error(`Invalid domain format: ${domain}`);
                        }

                        response = await fetch('/api/namecheap/nameservers', {
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
                    } else {
                        // Njalla
                        response = await fetch('/api/njalla/nameservers', {
                            method: 'POST',
                            headers: {
                                'x-api-key': headers['x-api-key'],
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                domain,
                                nameservers,
                            }),
                        });
                    }

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
    }, [accounts, proxyAccounts, njallaAccounts, parseDomain, buildHeaders, setNameserversCache]);

    return {
        fetchNameservers,
        setNameservers,
        loadingStates,
    };
}
