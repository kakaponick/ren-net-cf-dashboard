import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { processInParallel } from '@/lib/utils';
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
	const [dnsLoadingProgress, setDnsLoadingProgress] = useState<{ loaded: number; total: number; startTime: number; totalDomains?: number } | null>(null);
	const loadingZonesRef = useRef<Set<string>>(new Set()); // Track zones currently being loaded
	const hasLoadedZones = useRef(false);
	const progressToastIdRef = useRef<string | number | null>(null);
	const progressRef = useRef<{ loaded: number; total: number; startTime: number; totalDomains?: number } | null>(null);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

	const loadDNSRecordsProgressively = useCallback(async (forceRefresh = false) => {
		if (zones.length === 0 || accounts.length === 0) return;

		// First populate with cached records
		const recordsCache: Record<string, DNSRecord[]> = {};
		const zonesToLoad: Array<{ zoneId: string; accountId: string; zone: Zone }> = [];

		zones.forEach((item) => {
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

		setDnsRecordsCache(recordsCache);

		// Load remaining zones in parallel with controlled concurrency
		// Using concurrency of 15 to balance speed and rate limits
		// Cloudflare allows 1200 requests per 5 minutes (~4 req/sec), so 15 concurrent is safe
		if (zonesToLoad.length > 0) {
			const startTime = Date.now();
			const totalZones = zonesToLoad.length;
			
			// Initialize progress tracking with total domains count
			setDnsLoadingProgress({ loaded: 0, total: totalZones, startTime, totalDomains: zones.length });
			
			let loadedCount = 0;
			
			await processInParallel(
				zonesToLoad,
				async ({ zoneId, accountId }) => {
					await loadDNSForZone(zoneId, accountId);
					loadedCount++;
					setDnsLoadingProgress({ loaded: loadedCount, total: totalZones, startTime, totalDomains: zones.length });
				},
				15 // Process 15 zones concurrently
			);
			
			// Ensure progress shows 100% before clearing
			setDnsLoadingProgress({ loaded: totalZones, total: totalZones, startTime, totalDomains: zones.length });
			
			// Show completion toast and clear progress
			setTimeout(() => {
				// Calculate final elapsed time
				const finalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				
				if (progressToastIdRef.current) {
					toast.dismiss(progressToastIdRef.current);
					progressToastIdRef.current = null;
				}
				setDnsLoadingProgress(null);
				
				// Show completion message with elapsed time (infinite duration)
				if (zones.length > 0) {
					const toastId = toast.success(
						`Refreshed ${zones.length} domain${zones.length !== 1 ? 's' : ''} in ${finalElapsed}s`,
						{ 
							duration: Infinity,
							action: {
								label: 'Close',
								onClick: () => toast.dismiss(toastId)
							}
						}
					);
				}
			}, 500);
		} else {
			setDnsLoadingProgress(null);
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
						
						// Trigger progressive DNS loading after zones are set
						// Pass forceRefresh to also refresh DNS records when zones are refreshed
						setTimeout(() => loadDNSRecordsProgressively(forceRefresh), 0);
				} catch (error) {
						toast.error('Failed to load domains');
						console.error('Error loading zones:', error);
				} finally {
						setLoading('zones', '', false);
				}
		}, [accounts, isCacheValid, zones.length, setLoading, setZones, loadDNSRecordsProgressively]);

	// Helper function to create toast content - memoized to prevent unnecessary rerenders
	const createToastContent = useCallback((loaded: number, total: number, elapsedTime: number, totalDomains?: number) => {
		const percentage = Math.round((loaded / total) * 100);
		return (
			<div className="flex items-center gap-3 min-w-[280px]">
				<div className="flex-1 space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="font-medium">
							{totalDomains ? `Refreshing ${totalDomains} domain${totalDomains !== 1 ? 's' : ''}` : 'Loading DNS records'}
						</span>
						<span className="text-muted-foreground">{loaded}/{total}</span>
					</div>
					<div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
						<div
							className="h-full bg-primary transition-all duration-300"
							style={{ width: `${percentage}%` }}
						/>
					</div>
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>{percentage}%</span>
						<span>{elapsedTime.toFixed(1)}s</span>
					</div>
				</div>
			</div>
		);
	}, []);

	// Effect for progress state changes - updates refs and creates toast
	useEffect(() => {
		if (dnsLoadingProgress) {
			// Update ref with latest progress immediately
			progressRef.current = dnsLoadingProgress;
			
			// Create toast only once when progress starts
			if (!progressToastIdRef.current) {
				const { loaded, total, startTime, totalDomains } = dnsLoadingProgress;
				const elapsedTime = (Date.now() - startTime) / 1000;
				const toastContent = createToastContent(loaded, total, elapsedTime, totalDomains);
				
				progressToastIdRef.current = toast.loading(toastContent, {
					duration: Infinity,
				});
			}
		} else {
			// Clean up when progress is null
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
			if (progressToastIdRef.current) {
				toast.dismiss(progressToastIdRef.current);
				progressToastIdRef.current = null;
			}
			progressRef.current = null;
		}
	}, [dnsLoadingProgress, createToastContent]);

	// Single interval for toast updates - reads from refs, updates every 200ms for smooth elapsed time
	// This runs independently of React rerenders, preventing throttling
	useEffect(() => {
		if (dnsLoadingProgress && progressToastIdRef.current) {
			// Update toast content every 200ms with current progress and elapsed time
			// Reads from refs to avoid dependency on React state updates
			timerIntervalRef.current = setInterval(() => {
				const currentProgress = progressRef.current;
				if (!currentProgress || !progressToastIdRef.current) return;

				const { loaded, total, startTime, totalDomains } = currentProgress;
				const elapsedTime = (Date.now() - startTime) / 1000;
				const toastContent = createToastContent(loaded, total, elapsedTime, totalDomains);
				
				// Update toast with current values - sonner will efficiently update the existing toast
				toast.loading(toastContent, {
					id: progressToastIdRef.current,
					duration: Infinity,
				});
			}, 200); // 200ms provides smooth updates without excessive overhead

			return () => {
				if (timerIntervalRef.current) {
					clearInterval(timerIntervalRef.current);
					timerIntervalRef.current = null;
				}
			};
		}
	}, [dnsLoadingProgress, createToastContent]);

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
				dnsLoadingProgress,
				loadZones,
				loadDNSForZone,
				accountsLoading,
				accounts
		};
}




