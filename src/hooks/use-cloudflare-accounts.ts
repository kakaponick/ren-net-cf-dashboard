import { useState, useEffect, useMemo, useRef } from 'react';
import { useAccountStore } from '@/store/account-store';
import { toast } from 'sonner';
import type { CloudflareAccount } from '@/types/cloudflare';

interface UseCloudflareAccountsOptions {
	selectedAccountId: string;
	accounts?: CloudflareAccount[]; // Optional fallback accounts if store is empty
}

export function useCloudflareAccounts({ 
	selectedAccountId, 
	accounts = []
}: UseCloudflareAccountsOptions) {
	const { accounts: storeAccounts, fetchAndCacheCloudflareAccounts } = useAccountStore();
	const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
	const fetchingRef = useRef<string | null>(null);
	const lastCheckedAccountIdRef = useRef<string | null>(null);

	// Filter store accounts to only Cloudflare accounts
	const cloudflareStoreAccounts = useMemo(() => {
		return storeAccounts.filter(account => account.category === 'cloudflare');
	}, [storeAccounts]);

	// Use store accounts if available, otherwise fall back to props
	const accountsToUse = cloudflareStoreAccounts.length > 0 ? cloudflareStoreAccounts : accounts;
	
	// Memoize selected account to prevent unnecessary recalculations
	const selectedAccount = useMemo(() => {
		return accountsToUse.find(acc => acc.id === selectedAccountId);
	}, [accountsToUse, selectedAccountId]);

	// Get Cloudflare accounts for selected account - ensure we get the latest from store
	const cloudflareAccounts = useMemo(() => {
		const account = storeAccounts.length > 0 
			? storeAccounts.find(acc => acc.id === selectedAccountId)
			: accountsToUse.find(acc => acc.id === selectedAccountId);
		
		return account?.cloudflareAccounts || [];
	}, [storeAccounts, accountsToUse, selectedAccountId]);

	// Fetch Cloudflare accounts if not cached when account is selected
	useEffect(() => {
		if (!selectedAccountId) {
			fetchingRef.current = null;
			lastCheckedAccountIdRef.current = null;
			setIsLoadingAccounts(false);
			return;
		}

		// Always check the latest account from storeAccounts or accountsToUse
		const latestAccount = storeAccounts.length > 0 
			? storeAccounts.find(acc => acc.id === selectedAccountId)
			: accountsToUse.find(acc => acc.id === selectedAccountId);
		
		// Check if accounts are already cached
		const hasCachedAccounts = latestAccount?.cloudflareAccounts && latestAccount.cloudflareAccounts.length > 0;

		// If we've already checked this account ID, just update loading state
		if (lastCheckedAccountIdRef.current === selectedAccountId) {
			if (hasCachedAccounts) {
				setIsLoadingAccounts(false);
			}
			return;
		}

		// If accounts are cached, we're done
		if (hasCachedAccounts) {
			setIsLoadingAccounts(false);
			fetchingRef.current = null;
			lastCheckedAccountIdRef.current = selectedAccountId;
			return;
		}

		// If already fetching this account, don't fetch again
		if (fetchingRef.current === selectedAccountId) {
			return;
		}

		// Fetch accounts if not cached
		fetchingRef.current = selectedAccountId;
		lastCheckedAccountIdRef.current = selectedAccountId;
		setIsLoadingAccounts(true);
		
		fetchAndCacheCloudflareAccounts(selectedAccountId)
			.then(() => {
				if (fetchingRef.current === selectedAccountId) {
					fetchingRef.current = null;
					setIsLoadingAccounts(false);
				}
			})
			.catch((error) => {
				console.error('Failed to fetch Cloudflare accounts:', error);
				toast.error('Failed to load Cloudflare accounts');
				if (fetchingRef.current === selectedAccountId) {
					fetchingRef.current = null;
					setIsLoadingAccounts(false);
				}
			});
	}, [selectedAccountId, storeAccounts, accountsToUse, fetchAndCacheCloudflareAccounts]);

	// Clear loading state when accounts become available
	useEffect(() => {
		if (cloudflareAccounts.length > 0 && isLoadingAccounts && fetchingRef.current === null) {
			setIsLoadingAccounts(false);
		}
	}, [cloudflareAccounts.length, isLoadingAccounts]);

	return {
		accountsToUse,
		selectedAccount,
		cloudflareAccounts,
		isLoadingAccounts,
	};
}

