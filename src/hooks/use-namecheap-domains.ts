import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import type { NamecheapDomain, NamecheapAccount } from '@/types/namecheap';
import type { ProxyAccount } from '@/types/cloudflare';
import { processInParallel } from '@/lib/utils';

interface UseNamecheapDomainsReturn {
	domains: NamecheapDomain[];
	isLoading: boolean;
	isRefreshing: boolean;
	namecheapAccounts: NamecheapAccount[];
	loadDomains: (force?: boolean) => Promise<void>;
	refreshAccount: (accountId: string) => Promise<void>;
}

interface FetchResult {
	accountId: string;
	domains: NamecheapDomain[];
	error?: string;
}

export function useNamecheapDomains(): UseNamecheapDomainsReturn {
	const [domains, setDomains] = useState<NamecheapDomain[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);

	const { accounts, proxyAccounts } = useAccountStore();
	const { getNamecheapDomains, setNamecheapDomains, isCacheValid, _hasHydrated } = useCloudflareCache();

	// Derive Namecheap accounts from the main account store
	const namecheapAccounts = useMemo(() => {
		return accounts
			.filter((account) => account.category === 'registrar' && account.registrarName === 'namecheap')
			.map((account) => {
				// Use stored username if available, otherwise default to email prefix
				const defaultApiUser = account.email.split('@')[0].replaceAll('.', '');
				const apiUser = account.username || defaultApiUser;

				// Ensure all required fields for NamecheapAccount are present
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

	// Load cached domains on mount or when hydration completes
	useEffect(() => {
		if (!_hasHydrated) return;

		const cachedDomains: NamecheapDomain[] = [];
		let hasCahedData = false;

		for (const account of namecheapAccounts) {
			if (isCacheValid('namecheapDomains', account.id)) {
				const data = getNamecheapDomains(account.id);
				if (data?.domains && Array.isArray(data.domains)) {
					const domainsWithId = data.domains.map((d) => ({ ...d, accountId: account.id }));
					cachedDomains.push(...domainsWithId);
					hasCahedData = true;
				}
			}
		}

		if (hasCahedData) {
			setDomains(cachedDomains);
		}
	}, [namecheapAccounts, getNamecheapDomains, isCacheValid, _hasHydrated]);

	/**
	 * Fetches domains for a single account.
	 * Handles proxy requirement checks and API calls.
	 */
	const fetchAccountDomains = useCallback(
		async (account: NamecheapAccount): Promise<FetchResult> => {
			// Validation: Proxy is required for this API route implementation
			if (!account.proxyId) {
				return {
					accountId: account.id,
					domains: [],
					error: `Proxy missing for account ${account.name}`,
				};
			}

			// Find proxy details
			const proxy = proxyAccounts.find((p) => p.id === account.proxyId);
			if (!proxy) {
				return {
					accountId: account.id,
					domains: [],
					error: `Proxy with ID ${account.proxyId} not found for account ${account.name}`,
				};
			}

			// Prepare headers
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
						domains: [],
						error: `Invalid JSON response for ${account.name}`,
					};
				}

				if (!response.ok) {
					return {
						accountId: account.id,
						domains: [],
						error: data.error || `Failed to load domains for ${account.name}`,
					};
				}

				if (data.success && data.data && Array.isArray(data.data.domains)) {
					// Cache the successful result immediately
					setNamecheapDomains(account.id, account.name || account.email, data.data.domains);
					return {
						accountId: account.id,
						domains: data.data.domains,
					};
				} else {
					return {
						accountId: account.id,
						domains: [],
					};
				}
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : 'Unknown network error';
				console.error(`Network error for ${account.name}:`, error);
				return {
					accountId: account.id,
					domains: [],
					error: errMsg,
				};
			}
		},
		[proxyAccounts, setNamecheapDomains]
	);

	const loadDomains = useCallback(
		async (force = false) => {
			if (namecheapAccounts.length === 0) {
				setDomains([]);
				return;
			}

			// Use isRefreshing if domains are already loaded, otherwise isLoading
			const setLoadingState = domains.length > 0 || force ? setIsRefreshing : setIsLoading;
			setLoadingState(true);

			try {
				// Fetch all accounts in parallel using processInParallel
				const results = await processInParallel(
					namecheapAccounts,
					fetchAccountDomains,
					3 // Limit concurrency
				);

				const allDomains: NamecheapDomain[] = [];
				const errors: string[] = [];

				for (const result of results) {
					if (result.error) {
						errors.push(result.error);
					}
					if (result.domains.length > 0) {
						const domainsWithId = result.domains.map((d) => ({ ...d, accountId: result.accountId }));
						allDomains.push(...domainsWithId);
					}
				}

				// Update state
				setDomains(allDomains);

				// Show errors if any
				if (errors.length > 0) {
					// De-duplicate errors
					const uniqueErrors = Array.from(new Set(errors));
					// If many errors, just show a generic one, otherwise show specific ones
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
		[namecheapAccounts, fetchAccountDomains, domains.length]
	);

	const refreshAccount = useCallback(
		async (accountId: string) => {
			const account = namecheapAccounts.find((a) => a.id === accountId);
			if (!account) return;

			setIsRefreshing(true);
			try {
				const result = await fetchAccountDomains(account);
				if (result.error) {
					toast.error(result.error);
				} else if (result.domains.length > 0) {
					const domainsWithId = result.domains.map((d) => ({ ...d, accountId: result.accountId }));
					setDomains((prev) => {
						// Remove existing domains for this account and add new ones
						const filtered = prev.filter((d) => d.accountId !== accountId);
						return [...filtered, ...domainsWithId];
					});
					toast.success(`Loaded ${result.domains.length} domains for ${account.name}`);
				} else {
					// No domains found, clear existing ones just in case
					setDomains((prev) => prev.filter((d) => d.accountId !== accountId));
					toast.info(`No domains found for ${account.name}`);
				}
			} catch (error) {
				console.error('Error refreshing account:', error);
				toast.error('Failed to refresh account domains');
			} finally {
				setIsRefreshing(false);
			}
		},
		[namecheapAccounts, fetchAccountDomains]
	);

	return {
		domains,
		isLoading,
		isRefreshing,
		namecheapAccounts,
		loadDomains,
		refreshAccount,
	};
}