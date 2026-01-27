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
	const [isDnsLoading, setIsDnsLoading] = useState(false);
	const loadingZonesRef = useRef<Set<string>>(new Set()); // Track zones currently being loaded
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
				sslMode
			};

			return enriched;
		});
	}, [zones, accounts, dnsRecordsCache, dnsLoadingStates, getDNSRecords, getSSLData]);

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

			// Fetch both DNS records and SSL mode in parallel
			const [records, sslSetting] = await Promise.all([
				api.getDNSRecords(zoneId),
				api.getSSLSetting(zoneId).catch(err => {
					console.error(`Error loading SSL setting for zone ${zoneId}:`, err);
					return null;
				})
			]);

			setDnsRecordsCache(prev => ({ ...prev, [cacheKey]: records }));

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

			const promises = accountsToLoad.map(async (account) => {
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
			});

			const results = await Promise.all(promises);
			results.forEach((accountZones: any[]) => {
				fetchedZones.push(...accountZones);
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
		isLoading: isLoading.zones || isDnsLoading,
		isZonesLoading: isLoading.zones,
		isDnsLoading,
		loadZones,
		loadDNSForZone,
		accountsLoading,
		accounts
	};
}




