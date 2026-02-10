import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { getRootARecordsFromDNS, processInParallel } from '@/lib/utils';
import { toast } from 'sonner';
import type { DNSRecord, Zone } from '@/types/cloudflare';

export interface ZoneWithDNS {
	zone: Zone;
	accountId: string;
	accountName: string;
	accountEmail: string;
	dnsRecords?: DNSRecord[];
	rootARecords?: DNSRecord[];
	dnsLoading?: boolean;
	sslMode?: 'off' | 'flexible' | 'full' | 'strict';
	sslLoading?: boolean;
}

export function useDomainsData() {
	const { accounts: allAccounts, isLoading: accountsLoading } = useAccountStore();
	const accounts = allAccounts.filter(account => account.category === 'cloudflare');
	const {
		zones,
		isLoading,
		setZones,
		setLoading,
		isCacheValid,
		getDNSRecords,
		getSSLData
	} = useCloudflareCache();

	const [dnsRecordsCache, setDnsRecordsCache] = useState<Record<string, DNSRecord[]>>({});
	const [dnsLoadingStates, setDnsLoadingStates] = useState<Record<string, boolean>>({});
	const [sslLoadingStates, setSSLLoadingStates] = useState<Record<string, boolean>>({});
	const [isDnsLoading, setIsDnsLoading] = useState(false);
	const [isSSLLoading, setIsSSLLoading] = useState(false);
	const loadingZonesRef = useRef<Set<string>>(new Set()); // Track zones currently being loaded
	const loadingSSLRef = useRef<Set<string>>(new Set()); // Track SSL loads in progress
	const hasLoadedZones = useRef(false);

	const enrichedZones = useMemo(() => {
		if (zones.length === 0) return [];

		return zones.map(item => {
			const account = accounts.find(acc => acc.id === item.accountId);
			const cacheKey = `${item.zone.id}-${item.accountId}`;
			const records = dnsRecordsCache[cacheKey] || getDNSRecords(item.zone.id, item.accountId) || [];
			const rootARecords = getRootARecordsFromDNS(records, item.zone.name);
			const sslData = getSSLData(item.zone.id, item.accountId);
			const sslMode = sslData?.sslSetting?.value as 'off' | 'flexible' | 'full' | 'strict' | undefined;

			const enriched: ZoneWithDNS = {
				...item,
				accountEmail: account?.email || item.accountName,
				dnsRecords: records,
				rootARecords,
				dnsLoading: dnsLoadingStates[cacheKey] || false,
				sslMode,
				sslLoading: sslLoadingStates[cacheKey] || false
			};

			return enriched;
		});
	}, [zones, accounts, dnsRecordsCache, dnsLoadingStates, sslLoadingStates, getDNSRecords, getSSLData]);

	const loadDNSForZone = useCallback(async (zoneId: string, accountId: string) => {
		const cacheKey = `${zoneId}-${accountId}`;
		const account = accounts.find(acc => acc.id === accountId);
		if (!account) return;

		// Prevent duplicate concurrent requests
		if (loadingZonesRef.current.has(cacheKey)) {
			return;
		}

		loadingZonesRef.current.add(cacheKey);
		setDnsLoadingStates(prev => ({ ...prev, [cacheKey]: true }));

		try {
			const api = new CloudflareAPI(account.apiToken);

			// Fetch DNS records, SSL mode, and zone details (for status updates) in parallel
			const [records, sslSetting, zoneDetails] = await Promise.all([
				api.getDNSRecords(zoneId),
				api.getSSLSetting(zoneId).catch(err => {
					console.error(`Error loading SSL setting for zone ${zoneId}:`, err);
					return null;
				}),
				api.getZone(zoneId).catch(err => {
					console.error(`Error loading zone details for ${zoneId}:`, err);
					return null;
				})
			]);

			setDnsRecordsCache(prev => ({ ...prev, [cacheKey]: records }));

			// Update zone details in store if fetched successfully
			if (zoneDetails) {
				const { addZone } = useCloudflareCache.getState();
				// Ensure we preserve the account info
				addZone(zoneDetails, accountId, account.name || account.email);
			}

			// Cache SSL mode if available
			if (sslSetting) {
				const { setSSLData } = useCloudflareCache.getState();
				setSSLData(zoneId, accountId, [], sslSetting);
			}

			const { setDNSRecords } = useCloudflareCache.getState();
			setDNSRecords(zoneId, accountId, records);
		} catch (error) {
			console.error(`Error loading DNS records for zone ${zoneId}:`, error);
			// Cache empty array to prevent retrying failed requests
			setDnsRecordsCache(prev => ({ ...prev, [cacheKey]: [] }));
			const { setDNSRecords } = useCloudflareCache.getState();
			setDNSRecords(zoneId, accountId, []);
		} finally {
			setDnsLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
			loadingZonesRef.current.delete(cacheKey);
		}
	}, [accounts]);

	const loadDNSRecordsProgressively = useCallback(async (forceRefresh = false, targetAccountId?: string) => {
		// Read zones directly from store to avoid stale closure values
		const currentZones = useCloudflareCache.getState().zones;
		if (currentZones.length === 0 || accounts.length === 0) return;

		// First populate with cached records
		const recordsCache: Record<string, DNSRecord[]> = {};
		const zonesToLoad: Array<{ zoneId: string; accountId: string; zone: Zone }> = [];

		currentZones.forEach((item) => {
			// If targetAccountId is specified, skip zones from other accounts
			if (targetAccountId && item.accountId !== targetAccountId) return;

			const cacheKey = `${item.zone.id}-${item.accountId}`;
			const cachedRecords = getDNSRecords(item.zone.id, item.accountId);
			const cacheState = useCloudflareCache.getState();
			const hasCachedData = cacheState.dnsRecords[cacheKey] !== undefined;
			const isCacheValidForZone = forceRefresh ? false : isCacheValid('dnsRecords', cacheKey);

			// When force refreshing, reload DNS for all zones (including pending, in case status changed)
			if (forceRefresh) {
				zonesToLoad.push({ zoneId: item.zone.id, accountId: item.accountId, zone: item.zone });
			} else if (isCacheValidForZone || (hasCachedData && item.zone.status === 'pending')) {
				// Use cached data (even if empty for pending zones)
				recordsCache[cacheKey] = cachedRecords;
			} else if (item.zone.status !== 'pending') {
				// Only queue non-pending zones for loading
				zonesToLoad.push({ zoneId: item.zone.id, accountId: item.accountId, zone: item.zone });
			} else {
				// For pending zones without cache, cache empty array to prevent future requests
				recordsCache[cacheKey] = [];
				cacheState.setDNSRecords(item.zone.id, item.accountId, []);
			}
		});

		setDnsRecordsCache(prev => ({ ...prev, ...recordsCache }));

		// Load remaining zones in parallel with controlled concurrency
		// Using concurrency of 15 to balance speed and rate limits
		// Cloudflare allows 1200 requests per 5 minutes (~4 req/sec), so 15 concurrent is safe
		if (zonesToLoad.length > 0) {
			setIsDnsLoading(true);
			try {
				await processInParallel(
					zonesToLoad,
					async ({ zoneId, accountId }) => {
						await loadDNSForZone(zoneId, accountId);
					},
					15 // Process 15 zones concurrently
				);
			} finally {
				setIsDnsLoading(false);
			}
		}
	}, [accounts, getDNSRecords, isCacheValid, loadDNSForZone]);

	const loadZones = useCallback(async (forceRefresh = false, targetAccountId?: string) => {
		const accountsToLoad = targetAccountId
			? accounts.filter(a => a.id === targetAccountId)
			: accounts;

		if (accountsToLoad.length === 0) return;

		// If global refresh (no targetAccountId) and cache is valid, skip
		if (!targetAccountId && !forceRefresh && isCacheValid('zones') && zones.length > 0) {
			return;
		}

		setLoading('zones', '', true);
		try {
			const fetchedZones: any[] = [];

			const results = await processInParallel(
				accountsToLoad,
				async (account) => {
					try {
						const api = new CloudflareAPI(account.apiToken);
						const zonesData = await api.getZones();
						console.log(`Loaded ${zonesData.length} zones for account ${account.name}`);
						return zonesData.map((zone: any) => ({
							zone,
							accountId: account.id,
							accountName: account.name || account.email,
						}));
					} catch (error) {
						console.error(`Error loading zones for account ${account.name}:`, error);
						toast.error(`Failed to load zones for ${account.name}`);
						return [];
					}
				},
				5 // Limit concurrent account fetches
			);

			results.forEach((result) => {
				if (Array.isArray(result)) {
					fetchedZones.push(...result);
				}
			});

			// If targetAccountId is set, merge with existing zones from other accounts
			if (targetAccountId) {
				const currentZones = useCloudflareCache.getState().zones;
				// Keep zones from other accounts
				const otherZones = currentZones.filter(z => z.accountId !== targetAccountId);
				setZones([...otherZones, ...fetchedZones]);
			} else {
				// Otherwise replace all zones
				setZones(fetchedZones);
			}

			// Show success toast with domain count
			if (fetchedZones.length > 0) {
				toast.success(`Loaded ${fetchedZones.length} domain${fetchedZones.length !== 1 ? 's' : ''}`);
			}

			// Reset the flag so DNS loading can happen
			hasLoadedZones.current = false;

			// Trigger progressive DNS loading after zones are set
			// Pass forceRefresh to also refresh DNS records when zones are refreshed
			// Use a small delay to ensure zones state has propagated
			setTimeout(() => {
				loadDNSRecordsProgressively(forceRefresh, targetAccountId);
				hasLoadedZones.current = true;
			}, 100);
		} catch (error) {
			toast.error('Failed to load domains');
			console.error('Error loading zones:', error);
		} finally {
			setLoading('zones', '', false);
		}
	}, [accounts, isCacheValid, zones.length, setLoading, setZones, loadDNSRecordsProgressively]);

	// Refresh zones ONLY without triggering DNS/SSL refresh
	const refreshZonesOnly = useCallback(async (targetAccountId?: string) => {
		const accountsToLoad = targetAccountId
			? accounts.filter(a => a.id === targetAccountId)
			: accounts;

		if (accountsToLoad.length === 0) return;

		setLoading('zones', '', true);
		try {
			const fetchedZones: any[] = [];

			const results = await processInParallel(
				accountsToLoad,
				async (account) => {
					try {
						const api = new CloudflareAPI(account.apiToken);
						const zonesData = await api.getZones();
						console.log(`Loaded ${zonesData.length} zones for account ${account.name}`);
						return zonesData.map((zone: any) => ({
							zone,
							accountId: account.id,
							accountName: account.name || account.email,
						}));
					} catch (error) {
						console.error(`Error loading zones for account ${account.name}:`, error);
						toast.error(`Failed to load zones for ${account.name}`);
						return [];
					}
				},
				5 // Limit concurrent account fetches
			);

			results.forEach((result) => {
				if (Array.isArray(result)) {
					fetchedZones.push(...result);
				}
			});

			// If targetAccountId is set, merge with existing zones from other accounts
			if (targetAccountId) {
				const currentZones = useCloudflareCache.getState().zones;
				const otherZones = currentZones.filter(z => z.accountId !== targetAccountId);
				setZones([...otherZones, ...fetchedZones]);
			} else {
				setZones(fetchedZones);
			}

			if (fetchedZones.length > 0) {
				toast.success(`Refreshed ${fetchedZones.length} zone${fetchedZones.length !== 1 ? 's' : ''}`);
			}
		} catch (error) {
			toast.error('Failed to refresh zones');
			console.error('Error refreshing zones:', error);
		} finally {
			setLoading('zones', '', false);
		}
	}, [accounts, setLoading, setZones]);

	// Refresh DNS records for all zones
	const refreshAllDNS = useCallback(async (targetAccountId?: string) => {
		const currentZones = useCloudflareCache.getState().zones;
		if (currentZones.length === 0) {
			toast.error('No zones to refresh. Load zones first.');
			return;
		}

		const zonesToRefresh = currentZones.filter(item =>
			!targetAccountId || item.accountId === targetAccountId
		);

		if (zonesToRefresh.length === 0) return;

		// Clear old DNS data and set loading states for zones being refreshed
		const loadingStates: Record<string, boolean> = {};
		zonesToRefresh.forEach(({ zone, accountId }) => {
			const cacheKey = `${zone.id}-${accountId}`;
			loadingStates[cacheKey] = true;
			// Clear from local cache so we don't show stale data
			setDnsRecordsCache(prev => {
				const newCache = { ...prev };
				delete newCache[cacheKey];
				return newCache;
			});
		});
		setDnsLoadingStates(loadingStates);
		setIsDnsLoading(true);
		try {
			await processInParallel(
				zonesToRefresh,
				async ({ zone, accountId }) => {
					const account = accounts.find(acc => acc.id === accountId);
					if (!account) return;

					const cacheKey = `${zone.id}-${accountId}`;
					if (loadingZonesRef.current.has(cacheKey)) return;

					loadingZonesRef.current.add(cacheKey);
					setDnsLoadingStates(prev => ({ ...prev, [cacheKey]: true }));

					try {
						const api = new CloudflareAPI(account.apiToken);
						const records = await api.getDNSRecords(zone.id);
						setDnsRecordsCache(prev => ({ ...prev, [cacheKey]: records }));
						const { setDNSRecords } = useCloudflareCache.getState();
						setDNSRecords(zone.id, accountId, records);
					} catch (error) {
						console.error(`Error loading DNS for ${zone.name}:`, error);
					} finally {
						setDnsLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
						loadingZonesRef.current.delete(cacheKey);
					}
				},
				15
			);
			toast.success(`Refreshed DNS for ${zonesToRefresh.length} zone${zonesToRefresh.length !== 1 ? 's' : ''}`);
		} catch (error) {
			toast.error('Failed to refresh DNS records');
			console.error('Error refreshing DNS:', error);
		} finally {
			setIsDnsLoading(false);
		}
	}, [accounts]);

	// Refresh SSL settings for all zones
	const refreshAllSSL = useCallback(async (targetAccountId?: string) => {
		const currentZones = useCloudflareCache.getState().zones;
		if (currentZones.length === 0) {
			toast.error('No zones to refresh. Load zones first.');
			return;
		}

		const zonesToRefresh = currentZones.filter(item =>
			!targetAccountId || item.accountId === targetAccountId
		);

		if (zonesToRefresh.length === 0) return;

		// Clear old SSL data and set loading states for zones being refreshed
		const loadingStates: Record<string, boolean> = {};
		const { sslData } = useCloudflareCache.getState();
		zonesToRefresh.forEach(({ zone, accountId }) => {
			const cacheKey = `${zone.id}-${accountId}`;
			loadingStates[cacheKey] = true;
			// Clear from SSL cache so we don't show stale data
			delete sslData[cacheKey];
		});
		setSSLLoadingStates(loadingStates);
		setIsSSLLoading(true);
		try {
			await processInParallel(
				zonesToRefresh,
				async ({ zone, accountId }) => {
					const account = accounts.find(acc => acc.id === accountId);
					if (!account) return;

					const cacheKey = `${zone.id}-${accountId}`;
					if (loadingSSLRef.current.has(cacheKey)) return;

					loadingSSLRef.current.add(cacheKey);

					try {
						const api = new CloudflareAPI(account.apiToken);
						const sslSetting = await api.getSSLSetting(zone.id).catch(() => null);

						if (sslSetting) {
							const { setSSLData } = useCloudflareCache.getState();
							setSSLData(zone.id, accountId, [], sslSetting);
						}
					} catch (error) {
						console.error(`Error loading SSL for ${zone.name}:`, error);
					} finally {
						setSSLLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
						loadingSSLRef.current.delete(cacheKey);
					}
				},
				15
			);
			toast.success(`Refreshed SSL for ${zonesToRefresh.length} zone${zonesToRefresh.length !== 1 ? 's' : ''}`);
		} catch (error) {
			toast.error('Failed to refresh SSL settings');
			console.error('Error refreshing SSL:', error);
		} finally {
			setIsSSLLoading(false);
		}
	}, [accounts]);

	useEffect(() => {
		if (!accountsLoading && accounts.length > 0) {
			// Only load DNS records progressively if zones are already cached
			// Don't automatically load zones - user must click "Refresh Cache" button
			if (isCacheValid('zones') && zones.length > 0 && !hasLoadedZones.current) {
				loadDNSRecordsProgressively();
				hasLoadedZones.current = true;
			}
		}
	}, [accounts, accountsLoading, isCacheValid, zones.length, loadDNSRecordsProgressively]);

	return {
		enrichedZones,
		isLoading: isLoading.zones || isDnsLoading || isSSLLoading,
		isZonesLoading: isLoading.zones,
		isDnsLoading,
		isSSLLoading,
		loadZones,
		loadDNSForZone,
		refreshZonesOnly,
		refreshAllDNS,
		refreshAllSSL,
		accountsLoading,
		accounts
	};
}




