import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
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
}

export function useDomainsData() {
		const { accounts, isLoading: accountsLoading } = useAccountStore();
		const { 
				zones, 
				isLoading,
				setZones, 
				setLoading, 
				isCacheValid,
				getDNSRecords
		} = useCloudflareCache();

	const [dnsRecordsCache, setDnsRecordsCache] = useState<Record<string, DNSRecord[]>>({});
	const [dnsLoadingStates, setDnsLoadingStates] = useState<Record<string, boolean>>({});
	const loadingZonesRef = useRef<Set<string>>(new Set()); // Track zones currently being loaded
	const hasLoadedZones = useRef(false);

		const getRootARecordsFromDNS = useCallback((records: DNSRecord[], domainName: string): DNSRecord[] => {
				if (!records || records.length === 0) return [];
				return records.filter(
						(record) => record.type === 'A' && (record.name === domainName || record.name === '@' || record.name === '')
				);
		}, []);

		const enrichedZones = useMemo(() => {
				if (zones.length === 0) return [];
				
				return zones.map(item => {
						const account = accounts.find(acc => acc.id === item.accountId);
						const cacheKey = `${item.zone.id}-${item.accountId}`;
						const records = dnsRecordsCache[cacheKey] || getDNSRecords(item.zone.id, item.accountId) || [];
						const rootARecords = getRootARecordsFromDNS(records, item.zone.name);
						
						const enriched: ZoneWithDNS = {
								...item,
								accountEmail: account?.email || item.accountName,
								dnsRecords: records,
								rootARecords,
								dnsLoading: dnsLoadingStates[cacheKey] || false
						};
						
						return enriched;
				});
		}, [zones, accounts, dnsRecordsCache, dnsLoadingStates, getDNSRecords, getRootARecordsFromDNS]);

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
			const records = await api.getDNSRecords(zoneId);
			
			setDnsRecordsCache(prev => ({ ...prev, [cacheKey]: records }));
			
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

	const loadDNSRecordsProgressively = useCallback(async () => {
		if (zones.length === 0 || accounts.length === 0) return;

		// First populate with cached records
		const recordsCache: Record<string, DNSRecord[]> = {};
		const zonesToLoad: Array<{ zoneId: string; accountId: string; zone: Zone }> = [];

		zones.forEach((item) => {
			const cacheKey = `${item.zone.id}-${item.accountId}`;
			const cachedRecords = getDNSRecords(item.zone.id, item.accountId);
			const cacheState = useCloudflareCache.getState();
			const hasCachedData = cacheState.dnsRecords[cacheKey] !== undefined;
			const isCacheValidForZone = isCacheValid('dnsRecords', cacheKey);
			
			// Skip pending domains - they typically don't have DNS records yet
			// Only load if zone is active or if we have valid cached data
			if (isCacheValidForZone || (hasCachedData && item.zone.status === 'pending')) {
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

		setDnsRecordsCache(recordsCache);

		// Load remaining zones progressively (only active zones)
		for (const { zoneId, accountId } of zonesToLoad) {
			await loadDNSForZone(zoneId, accountId);
		}
	}, [zones, accounts, getDNSRecords, isCacheValid, loadDNSForZone]);

		const loadZones = useCallback(async (forceRefresh = false) => {
				if (accounts.length === 0) return;

				if (!forceRefresh && isCacheValid('zones') && zones.length > 0) {
						return;
				}

				setLoading('zones', '', true);
				try {
						const allZones: any[] = [];
						
						const promises = accounts.map(async (account) => {
								try {
										const api = new CloudflareAPI(account.apiToken);
										const zonesData = await api.getZones();
										console.log(`Loaded ${zonesData.length} zones for account ${account.name}`);
										return zonesData.map((zone: any) => ({
												zone,
												accountId: account.id,
												accountName: account.name,
										}));
								} catch (error) {
										console.error(`Error loading zones for account ${account.name}:`, error);
										toast.error(`Failed to load zones for ${account.name}`);
										return [];
								}
						});

						const results = await Promise.all(promises);
						results.forEach((accountZones: any[]) => {
								allZones.push(...accountZones);
						});

						setZones(allZones);
						toast.success(`Loaded ${allZones.length} domains from ${accounts.length} accounts`);
						
						// Trigger progressive DNS loading after zones are set
						setTimeout(() => loadDNSRecordsProgressively(), 0);
				} catch (error) {
						toast.error('Failed to load domains');
						console.error('Error loading zones:', error);
				} finally {
						setLoading('zones', '', false);
				}
		}, [accounts, isCacheValid, zones.length, setLoading, setZones, loadDNSRecordsProgressively]);

		useEffect(() => {
				if (!accountsLoading && accounts.length > 0) {
						if (!isCacheValid('zones') || zones.length === 0) {
								loadZones().then(() => {
										hasLoadedZones.current = true;
								});
						} else if (!hasLoadedZones.current) {
								loadDNSRecordsProgressively();
								hasLoadedZones.current = true;
						}
				}
		}, [accounts, accountsLoading, isCacheValid, zones.length, loadZones, loadDNSRecordsProgressively]);

		return {
				enrichedZones,
				isLoading: isLoading.zones,
				loadZones,
				loadDNSForZone,
				accountsLoading,
				accounts
		};
}




