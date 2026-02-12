import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { useTaskStore } from '@/store/task-store';
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

	// const [dnsRecordsCache, setDnsRecordsCache] = useState<Record<string, DNSRecord[]>>({}); // Removed in favor of global store
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
			// Read directly from store via getDNSRecords (which reads from state.dnsRecords)
			const records = getDNSRecords(item.zone.id, item.accountId) || [];
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
		// Removed dnsRecordsCache dependency
	}, [zones, accounts, dnsLoadingStates, sslLoadingStates, getDNSRecords, getSSLData]);

	const loadDNSForZone = useCallback(async (zoneId: string, accountId: string, skipStoreUpdate = false) => {
		const cacheKey = `${zoneId}-${accountId}`;
		const account = accounts.find(acc => acc.id === accountId);
		if (!account) return null;

		// Prevent duplicate concurrent requests
		if (loadingZonesRef.current.has(cacheKey)) {
			return null;
		}

		loadingZonesRef.current.add(cacheKey);
		setDnsLoadingStates(prev => ({ ...prev, [cacheKey]: true }));
		// Also indicate SSL is loading since we fetch it too
		setSSLLoadingStates(prev => ({ ...prev, [cacheKey]: true }));

		try {
			const api = new CloudflareAPI(account.apiToken);

			// Fetch DNS records, SSL mode, and zone details (for status updates) in parallel
			const [records, sslSetting, zoneDetails] = await Promise.all([
				api.getDNSRecords(zoneId),
				api.getSSLSetting(zoneId).catch(err => {
					console.error(`Error loading SSL setting for zone ${zoneId}:`, err);
					const { addLog } = useTaskStore.getState();
					addLog(`Failed to load SSL for zone ${zoneId}`, 'error');
					return null;
				}),
				api.getZone(zoneId).catch(err => {
					console.error(`Error loading zone details for ${zoneId}:`, err);
					return null;
				})
			]);

			if (!skipStoreUpdate) {
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
			}

			return { records, sslSetting, zoneDetails };
		} catch (error) {
			console.error(`Error loading DNS records for zone ${zoneId}:`, error);
			const { setDNSRecords } = useCloudflareCache.getState();
			setDNSRecords(zoneId, accountId, []);
			return null;
		} finally {
			setDnsLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
			setSSLLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
			loadingZonesRef.current.delete(cacheKey);
		}
	}, [accounts]);

	// Helper to check task status and handle pause/stop
	const checkTaskStatus = async () => {
		const { status } = useTaskStore.getState();

		if (status === 'stopped') {
			throw new Error('Task stopped by user');
		}

		if (status === 'paused') {
			// Poll until resumed or stopped
			while (useTaskStore.getState().status === 'paused') {
				await new Promise(resolve => setTimeout(resolve, 500));
			}
			// Check again after pause loop
			if (useTaskStore.getState().status === 'stopped') {
				throw new Error('Task stopped by user');
			}
		}
	};


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



		// Load remaining zones in parallel with controlled concurrency
		// Using concurrency of 15 to balance speed and rate limits
		// Cloudflare allows 1200 requests per 5 minutes (~4 req/sec), so 15 concurrent is safe
		if (zonesToLoad.length > 0) {
			setIsDnsLoading(true);

			if (forceRefresh) {
				const { addLog, updateProgress, startTask } = useTaskStore.getState();
				// Also get batchClearDNS and batchClearSSL from cloudflare store
				const { batchClearDNS: cfBatchClearDNS, batchClearSSL: cfBatchClearSSL } = useCloudflareCache.getState();

				// Ensure task is running properly
				if (useTaskStore.getState().status !== 'running') {
					startTask('refresh_dns', 'Loading DNS & SSL Records', zonesToLoad.length);
				} else {
					// Update existing task totals
					useTaskStore.setState({ totalItems: zonesToLoad.length, processedItems: 0 });
				}

				addLog(`Loading DNS & SSL records for ${zonesToLoad.length} zones...`, 'info');

				// Clear old DNS data and set loading states for zones being refreshed
				const loadingStates: Record<string, boolean> = {};
				const sslLoadingStatesUpdate: Record<string, boolean> = {};
				const cacheKeysToClear: string[] = [];

				zonesToLoad.forEach(({ zoneId, accountId }) => {
					const cacheKey = `${zoneId}-${accountId}`;
					loadingStates[cacheKey] = true;
					sslLoadingStatesUpdate[cacheKey] = true;
					cacheKeysToClear.push(cacheKey);
				});

				// Batch clear from local state (Removed)

				// Batch clear from store
				cfBatchClearDNS(cacheKeysToClear);
				cfBatchClearSSL(cacheKeysToClear);

				// Update loading states
				setDnsLoadingStates(prev => ({ ...prev, ...loadingStates }));
				setSSLLoadingStates(prev => ({ ...prev, ...sslLoadingStatesUpdate }));
			}

			try {
				let processedZones = 0;
				const totalZones = zonesToLoad.length;
				// Shared buffer for batching updates
				const pendingUpdates: { zoneId: string; accountId: string; records: any[] }[] = [];
				const { batchSetDNSRecords } = useCloudflareCache.getState();

				// Group zones by account to optimize API usage
				const zonesByAccount: Record<string, typeof zonesToLoad> = {};
				zonesToLoad.forEach(z => {
					if (!zonesByAccount[z.accountId]) {
						zonesByAccount[z.accountId] = [];
					}
					zonesByAccount[z.accountId].push(z);
				});

				// Process accounts in parallel, and within each account, process zones in parallel
				await processInParallel(
					Object.entries(zonesByAccount),
					async ([accountId, accountZones]) => {
						await checkTaskStatus();
						await processInParallel(
							accountZones,
							async ({ zoneId }) => {
								await checkTaskStatus();
								const result = await loadDNSForZone(zoneId, accountId, forceRefresh); // Skip store update if forceRefresh (bulk op)

								if (forceRefresh && result) {
									processedZones++;
									const { updateProgress } = useTaskStore.getState();

									// Add to buffer
									pendingUpdates.push({
										zoneId,
										accountId,
										records: result.records
									});

									// Flush buffer if full (smaller batch size for faster initial feedback)
									if (pendingUpdates.length >= 10) {
										const batch = [...pendingUpdates];
										pendingUpdates.length = 0;
										batchSetDNSRecords(batch);
									}

									// Throttle progress updates: only update every 1% or every 2 items
									const percent = Math.round((processedZones / totalZones) * 100);
									if (processedZones % 2 === 0 || percent % 1 === 0) {
										updateProgress(percent, processedZones);
									}
								}
							},
							8 // Increased concurrency per account (assuming separate rate limits or high capacity)
						);
					},
					5 // Process up to 5 accounts simultaneously
				);

				// Flush remaining items
				if (pendingUpdates.length > 0) {
					batchSetDNSRecords(pendingUpdates);
				}

				if (forceRefresh) {
					const { completeTask, addLog } = useTaskStore.getState();
					addLog('All DNS records loaded successfully', 'success');
					completeTask();
				}
			} catch (error) {
				if (forceRefresh) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					if (errorMsg === 'Task stopped by user') {
						useTaskStore.getState().addLog('Task stopped by user', 'error');
						// Don't fail task, just stop
					} else {
						useTaskStore.getState().failTask('Failed to load some DNS records');
					}
				}
			} finally {
				setIsDnsLoading(false);
			}
		} else if (forceRefresh) {
			const { completeTask, addLog, updateProgress } = useTaskStore.getState();
			addLog('No DNS records to refresh', 'info');
			updateProgress(100, 0);
			completeTask();
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

		// Start task if force refresh
		if (forceRefresh) {
			const { startTask, addLog, updateProgress, completeTask, failTask } = useTaskStore.getState();
			startTask('refresh_zones', 'Refreshing Zones', accountsToLoad.length);
			addLog('Starting zone refresh...', 'info');

			// Clear local DNS cache immediately for full refresh to prevent stale data
			if (!targetAccountId) {
				// Initialize with empty zones for full refresh to allow incremental updates
				setZones([]);
			} else {
				// For target account, remove its zones first
				const currentZones = useCloudflareCache.getState().zones;
				const otherZones = currentZones.filter(z => z.accountId !== targetAccountId);
				setZones(otherZones);
			}
		}

		try {
			const fetchedZones: any[] = []; // Keep track for final verification if needed
			const totalAccounts = accountsToLoad.length;
			let processedAccounts = 0;

			// Initialize processed item count if task is running
			if (forceRefresh) {
				useTaskStore.setState({ processedItems: 0 });
			}

			await processInParallel(
				accountsToLoad,
				async (account) => {
					// Check for stop/pause before processing each account
					if (forceRefresh) await checkTaskStatus();

					try {
						const api = new CloudflareAPI(account.apiToken);
						const zonesData = await api.getZones();

						if (forceRefresh) {
							const { addLog, updateProgress } = useTaskStore.getState();
							addLog(`Loaded ${zonesData.length} zones for ${account.name || account.email}`, 'info');
							processedAccounts++;
							updateProgress(Math.round((processedAccounts / totalAccounts) * 40), processedAccounts); // First 40%
						} else {
							console.log(`Loaded ${zonesData.length} zones for account ${account.name}`);
						}

						const newZones = zonesData.map((zone: any) => ({
							zone,
							accountId: account.id,
							accountName: account.name || account.email,
						}));

						// Incrementally update store
						const { zones: currentZones, setZones } = useCloudflareCache.getState();
						setZones([...currentZones, ...newZones]);

						return newZones;
					} catch (error) {
						if (forceRefresh) {
							const { addLog } = useTaskStore.getState();
							addLog(`Failed to load zones for ${account.name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
						} else {
							console.error(`Error loading zones for account ${account.name}:`, error);
							toast.error(`Failed to load zones for ${account.name}`);
						}
						return [];
					}
				},
				5 // Limit concurrent account fetches
			);

			// No need to setZones at the end as we did it incrementally

			if (forceRefresh) {
				// Count total from store as we updated incrementally
				const finalZones = useCloudflareCache.getState().zones;
				const newZonesCount = targetAccountId
					? finalZones.filter(z => z.accountId === targetAccountId).length
					: finalZones.length;
				useTaskStore.getState().addLog(`Total zones fetched: ${newZonesCount}`, 'success');
			}

			// Prevent auto-effect from firing by setting this to true immediately
			hasLoadedZones.current = true;

			// Trigger progressive DNS loading after zones are set
			// Pass forceRefresh to also refresh DNS records when zones are refreshed
			// Use a small delay to ensure zones state has propagated to the store
			setTimeout(() => {
				loadDNSRecordsProgressively(forceRefresh, targetAccountId);
			}, 100);
		} catch (error) {
			if (forceRefresh) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				if (errorMsg === 'Task stopped by user') {
					useTaskStore.getState().addLog('Task stopped by user', 'error');
					// Don't fail task, just stop
				} else {
					useTaskStore.getState().failTask(`Failed to load domains: ${errorMsg}`);
				}
			}
			if (error instanceof Error && error.message !== 'Task stopped by user') {
				toast.error('Failed to load domains');
				console.error('Error loading zones:', error);
			}
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

		const { startTask, addLog, updateProgress, completeTask, failTask } = useTaskStore.getState();
		startTask('refresh_zones', 'Refreshing Zones Only', accountsToLoad.length);
		addLog('Starting only zone refresh (skipping DNS/SSL)...', 'info');

		// Clear/Prepare cache for incremental updates
		if (!targetAccountId) {
			setZones([]);
		} else {
			const currentZones = useCloudflareCache.getState().zones;
			const otherZones = currentZones.filter(z => z.accountId !== targetAccountId);
			setZones(otherZones);
		}

		try {
			const totalAccounts = accountsToLoad.length;
			let processedAccounts = 0;

			await processInParallel(
				accountsToLoad,
				async (account) => {
					try {
						const api = new CloudflareAPI(account.apiToken);
						const zonesData = await api.getZones();
						addLog(`Loaded ${zonesData.length} zones for ${account.name || account.email}`, 'info');

						processedAccounts++;
						updateProgress(Math.round((processedAccounts / totalAccounts) * 100), processedAccounts);

						const newZones = zonesData.map((zone: any) => ({
							zone,
							accountId: account.id,
							accountName: account.name || account.email,
						}));

						// Incrementally update
						const { zones: currentZones, setZones } = useCloudflareCache.getState();
						setZones([...currentZones, ...newZones]);

						return newZones;
					} catch (error) {
						addLog(`Error loading zones for ${account.name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
						console.error(`Error loading zones for account ${account.name}:`, error);
						return [];
					}
				},
				5 // Limit concurrent account fetches
			);

			// Calculate total from store state
			const finalZones = useCloudflareCache.getState().zones;
			const fetchedCount = targetAccountId
				? finalZones.filter(z => z.accountId === targetAccountId).length
				: finalZones.length;

			if (fetchedCount > 0) {
				addLog(`Successfully refreshed ${fetchedCount} zones`, 'success');
				toast.success(`Refreshed ${fetchedCount} zone${fetchedCount !== 1 ? 's' : ''}`);
			}
			completeTask();
		} catch (error) {
			failTask(`Failed to refresh zones: ${error instanceof Error ? error.message : String(error)}`);
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

		const { startTask, addLog, updateProgress, completeTask, failTask } = useTaskStore.getState();
		startTask('refresh_dns', 'Refreshing DNS Records', zonesToRefresh.length);
		addLog(`Starting DNS refresh for ${zonesToRefresh.length} zones...`, 'info');

		// Clear old DNS data and set loading states for zones being refreshed
		const loadingStates: Record<string, boolean> = {};
		const cacheKeysToClear: string[] = [];
		const pendingUpdates: { zoneId: string; accountId: string; records: any[] }[] = [];
		const { batchSetDNSRecords } = useCloudflareCache.getState();

		zonesToRefresh.forEach(({ zone, accountId }) => {
			const cacheKey = `${zone.id}-${accountId}`;
			loadingStates[cacheKey] = true;
			cacheKeysToClear.push(cacheKey);
		});

		// Batch clear from local state (Removed)

		const { batchClearDNS } = useCloudflareCache.getState();
		batchClearDNS(cacheKeysToClear);

		setDnsLoadingStates(loadingStates);
		setIsDnsLoading(true);
		addLog('Cleared existing DNS cache', 'info');

		try {
			let processedZones = 0;
			const totalZones = zonesToRefresh.length;

			// Group zones by account
			const zonesByAccount: Record<string, typeof zonesToRefresh> = {};
			zonesToRefresh.forEach(z => {
				if (!zonesByAccount[z.accountId]) {
					zonesByAccount[z.accountId] = [];
				}
				zonesByAccount[z.accountId].push(z);
			});

			await processInParallel(
				Object.entries(zonesByAccount),
				async ([accountId, accountZones]) => {
					await checkTaskStatus();
					await processInParallel(
						accountZones,
						async ({ zone, accountId }) => {
							await checkTaskStatus();

							// Check account existence again or rely on closure
							const account = accounts.find(acc => acc.id === accountId);
							if (!account) return;

							const cacheKey = `${zone.id}-${accountId}`;
							if (loadingZonesRef.current.has(cacheKey)) return;

							loadingZonesRef.current.add(cacheKey);
							setDnsLoadingStates(prev => ({ ...prev, [cacheKey]: true }));

							try {
								const api = new CloudflareAPI(account.apiToken);
								const records = await api.getDNSRecords(zone.id);

								processedZones++;
								const percent = Math.round((processedZones / totalZones) * 100);
								if (processedZones % 2 === 0 || percent % 1 === 0) {
									updateProgress(percent, processedZones);
								}

								// Add to batch
								pendingUpdates.push({ zoneId: zone.id, accountId, records });

								// Flush if enough items
								if (pendingUpdates.length >= 10) {
									const batch = [...pendingUpdates];
									pendingUpdates.length = 0;
									batchSetDNSRecords(batch);
								}
							} catch (error) {
								addLog(`Error loading DNS for ${zone.name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
								console.error(`Error loading DNS for ${zone.name}:`, error);
							} finally {
								setDnsLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
								loadingZonesRef.current.delete(cacheKey);
							}
						},
						8 // Concurrency per account
					);
				},
				5 // Concurrency of accounts
			);

			// Flush remaining items
			if (pendingUpdates.length > 0) {
				batchSetDNSRecords(pendingUpdates);
			}
			addLog(`Successfully refreshed DNS for ${zonesToRefresh.length} zones`, 'success');
			toast.success(`Refreshed DNS for ${zonesToRefresh.length} zone${zonesToRefresh.length !== 1 ? 's' : ''}`);
			completeTask();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg === 'Task stopped by user') {
				useTaskStore.getState().addLog('Task stopped by user', 'error');
				// Don't fail task, just stop
			} else {
				failTask(`Failed to refresh DNS records: ${errorMsg}`);
				toast.error('Failed to refresh DNS records');
				console.error('Error refreshing DNS:', error);
			}
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

		const { startTask, addLog, updateProgress, completeTask, failTask } = useTaskStore.getState();
		startTask('refresh_ssl', 'Refreshing SSL Settings', zonesToRefresh.length);
		addLog(`Starting SSL refresh for ${zonesToRefresh.length} zones...`, 'info');

		// Clear old SSL data and set loading states for zones being refreshed
		const loadingStates: Record<string, boolean> = {};
		const cacheKeysToClear: string[] = [];

		zonesToRefresh.forEach(({ zone, accountId }) => {
			const cacheKey = `${zone.id}-${accountId}`;
			loadingStates[cacheKey] = true;
			cacheKeysToClear.push(cacheKey);
		});

		const { batchClearSSL } = useCloudflareCache.getState();
		batchClearSSL(cacheKeysToClear);

		setSSLLoadingStates(loadingStates);
		setIsSSLLoading(true);
		addLog('Cleared existing SSL cache', 'info');

		try {
			let processedZones = 0;
			const totalZones = zonesToRefresh.length;
			const pendingUpdates: { zoneId: string; accountId: string; certificates: any[]; sslSetting: any }[] = [];
			const { batchSetSSLData } = useCloudflareCache.getState();

			// Group zones by account
			const zonesByAccount: Record<string, typeof zonesToRefresh> = {};
			zonesToRefresh.forEach(z => {
				if (!zonesByAccount[z.accountId]) {
					zonesByAccount[z.accountId] = [];
				}
				zonesByAccount[z.accountId].push(z);
			});

			// Configure concurrency: 
			// 5 concurrent accounts, 8 concurrent requests per account
			await processInParallel(
				Object.entries(zonesByAccount),
				async ([accountId, accountZones]) => {
					await checkTaskStatus();
					await processInParallel(
						accountZones,
						async ({ zone, accountId }) => {
							await checkTaskStatus();

							const account = accounts.find(acc => acc.id === accountId);
							if (!account) return;

							const cacheKey = `${zone.id}-${accountId}`;
							if (loadingSSLRef.current.has(cacheKey)) return;

							loadingSSLRef.current.add(cacheKey);

							try {
								const api = new CloudflareAPI(account.apiToken);
								// Fetch SSL setting
								const sslSetting = await api.getSSLSetting(zone.id);

								processedZones++;
								const percent = Math.round((processedZones / totalZones) * 100);

								// Update progress more frequently for better UX
								if (processedZones % 2 === 0 || percent % 1 === 0) {
									updateProgress(percent, processedZones);
								}

								if (sslSetting) {
									// Add to batch
									pendingUpdates.push({ zoneId: zone.id, accountId, certificates: [], sslSetting });

									// Flush if enough items (smaller batch size for faster initial feedback)
									if (pendingUpdates.length >= 10) {
										const batch = [...pendingUpdates];
										pendingUpdates.length = 0;
										batchSetSSLData(batch);
									}
								}
							} catch (error) {
								// Explicit log for individual failures to ensure visibility
								console.error(`Error fetching SSL for ${zone.name}:`, error);
								// Don't show toast for every error to avoid spamming
								addLog(`Failed SSL fetch for ${zone.name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
							} finally {
								setSSLLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
								loadingSSLRef.current.delete(cacheKey);
							}
						},
						8 // Concurrency per account
					);
				},
				5 // Concurrency of accounts
			);

			// Flush remaining items
			if (pendingUpdates.length > 0) {
				batchSetSSLData(pendingUpdates);
			}
			addLog(`Successfully refreshed SSL for ${zonesToRefresh.length} zones`, 'success');
			toast.success(`Refreshed SSL for ${zonesToRefresh.length} zone${zonesToRefresh.length !== 1 ? 's' : ''}`);
			completeTask();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg === 'Task stopped by user') {
				useTaskStore.getState().addLog('Task stopped by user', 'error');
				// Don't fail task, just stop
			} else {
				failTask(`Failed to refresh SSL settings: ${errorMsg}`);
				toast.error('Failed to refresh SSL settings');
				console.error('Error refreshing SSL:', error);
			}
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




