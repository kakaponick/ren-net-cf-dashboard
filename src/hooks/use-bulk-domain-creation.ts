import { useState, useRef, useCallback, useEffect } from 'react';
import { CloudflareAPI, type ZoneSettingsProgressCallback } from '@/lib/cloudflare-api';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { toast } from 'sonner';
import { formatCloudflareError } from '@/lib/utils';
import type { DomainQueueItem, ConfigurationStep } from '@/components/configuration-console';
import type { CloudflareAccount, DNSRecord, ProxyAccount } from '@/types/cloudflare';

interface UseBulkDomainCreationOptions {
	account: CloudflareAccount;
	cloudflareAccountId: string;
	onSuccess: () => void;
	// Optional: auto-set nameservers at registrar after zone creation
	registrarAccountId?: string;
	registrarAccounts?: CloudflareAccount[];
	proxyAccounts?: ProxyAccount[];
}

export function useBulkDomainCreation({ account, cloudflareAccountId, onSuccess, registrarAccountId, registrarAccounts = [], proxyAccounts = [] }: UseBulkDomainCreationOptions) {
	const { setDomainNameservers } = useAccountStore();
	const { addZone, setDNSRecords } = useCloudflareCache();
	const [isCreating, setIsCreating] = useState(false);
	const [isConfiguring, setIsConfiguring] = useState(false);
	const [domainQueue, setDomainQueue] = useState<DomainQueueItem[]>([]);
	const domainQueueRef = useRef<DomainQueueItem[]>([]);
	const abortControllerRef = useRef<AbortController | null>(null);
	const isProcessingRef = useRef(false);

	// Keep ref in sync with state
	const updateQueue = (updater: (prev: DomainQueueItem[]) => DomainQueueItem[]) => {
		setDomainQueue(prev => {
			const next = updater(prev);
			domainQueueRef.current = next;
			return next;
		});
	};

	const setDomainStatus = (domain: string, status: DomainQueueItem['status']) => {
		updateQueue(prev => prev.map(item =>
			item.domain === domain
				? { ...item, status }
				: item
		));
	};

	const setStepState = (
		domain: string,
		stepName: string,
		status: ConfigurationStep['status'],
		error?: string
	) => {
		updateQueue(prev => prev.map(item => {
			if (item.domain !== domain) return item;

			const steps = item.steps || [];
			const index = steps.findIndex(s => s.name === stepName);
			const existing = steps[index];
			const nextStep: ConfigurationStep = {
				name: stepName,
				status,
				error,
				variable: existing?.variable,
			};

			const nextSteps = index >= 0 ? [...steps] : [...steps, nextStep];
			nextSteps[index >= 0 ? index : nextSteps.length - 1] = nextStep;

			return { ...item, steps: nextSteps };
		}));
	};

	const refreshDNSRecords = async (zoneId: string, api: CloudflareAPI) => {
		try {
			const records = await api.getDNSRecords(zoneId);
			setDNSRecords(zoneId, account.id, records);
		} catch (error) {
			console.error('Error refreshing DNS cache:', error);
		}
	};

	// Sync ref with state on mount and when queue changes
	useEffect(() => {
		domainQueueRef.current = domainQueue;
	}, [domainQueue]);

	const syncDNSCache = (zoneId: string, records: DNSRecord[]) => {
		setDNSRecords(zoneId, account.id, records);
	};

	const processDomain = async (
		queueItem: DomainQueueItem,
		api: CloudflareAPI,
		signal: AbortSignal
	): Promise<{ success: boolean }> => {
		const domain = queueItem.domain;
		const rootIPAddress = queueItem.rootIPAddress || '';
		const proxied = queueItem.proxied ?? true;
		const createdRecords: DNSRecord[] = [];

		// Update domain status to processing
		updateQueue(prev => prev.map(item =>
			item.domain === domain
				? { ...item, status: 'processing', steps: [{ name: 'Creating domain zone...', status: 'processing' }] }
				: item
		));

		try {
			// Step 1: Create zone
			const zone = await api.createZone(domain, cloudflareAccountId);

			// Add zone to cache immediately for reactive UI update
			if (zone?.id) {
				addZone(zone, account.id, account.name || 'Unnamed Account');
			}

			// Update step to success
			updateQueue(prev => prev.map(item =>
				item.domain === domain
					? {
						...item,
						steps: [{ name: 'Creating domain zone...', status: 'success' }],
						nameservers: zone?.name_servers || [],
						zoneId: zone?.id
					}
					: item
			));

			// Save nameservers to store
			if (zone?.name_servers && Array.isArray(zone.name_servers) && zone.name_servers.length > 0) {
				setDomainNameservers(domain, zone.name_servers);
			}

			// Step 2: Set nameservers at registrar (optional)
			if (registrarAccountId && zone?.name_servers?.length) {
				const nsStepName = 'Setting nameservers at registrar...';
				const regAccount = registrarAccounts.find((a) => a.id === registrarAccountId);
				if (!regAccount) {
					setStepState(domain, nsStepName, 'error', 'Registrar account not found');
				} else {
					setStepState(domain, nsStepName, 'processing');

					try {
						if (regAccount.registrarName === 'namecheap') {
							const proxy = proxyAccounts.find((p) => p.id === regAccount.proxyId);
							if (!proxy) throw new Error(`Proxy not found for Namecheap account ${regAccount.name || regAccount.email}`);

							const parts = domain.split('.');
							const tld = parts[parts.length - 1];
							const sld = parts.slice(0, -1).join('.');

							const headers: Record<string, string> = {
								'Content-Type': 'application/json',
								'x-account-id': regAccount.id,
								'x-api-user': regAccount.username || regAccount.email.split('@')[0].replaceAll('.', ''),
								'x-api-key': regAccount.apiToken,
								'x-proxy-host': proxy.host,
								'x-proxy-port': proxy.port?.toString() || '',
							};
							if (proxy.username) headers['x-proxy-username'] = proxy.username;
							if (proxy.password) headers['x-proxy-password'] = proxy.password;

							const resp = await fetch('/api/namecheap/nameservers', {
								method: 'POST',
								headers,
								body: JSON.stringify({ sld, tld, nameservers: zone.name_servers }),
							});
							const data = await resp.json();
							if (!resp.ok || !data.success) throw new Error(data.error || 'Failed to set nameservers');
						} else if (regAccount.registrarName === 'njalla') {
							const resp = await fetch('/api/njalla/nameservers', {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'x-api-key': regAccount.apiToken,
								},
								body: JSON.stringify({ domain, nameservers: zone.name_servers }),
							});
							const data = await resp.json();
							if (!resp.ok || !data.success) throw new Error(data.error || 'Failed to set nameservers');
						}

						setStepState(domain, nsStepName, 'success');
					} catch (nsError) {
						console.error(`Error setting nameservers for ${domain}:`, nsError);
						const nsErrorMessage = nsError instanceof Error ? nsError.message : 'Unknown error';
						setStepState(domain, nsStepName, 'error', nsErrorMessage);
						// Non-fatal: continue to mark domain as success
					}
				}
			}

			// Step 3: Create CNAME record for www subdomain
			if (zone?.id) {
				updateQueue(prev => prev.map(item => {
					if (item.domain !== domain) return item;
					const existingSteps = item.steps || [];
					const nsStep = existingSteps.find(s => s.name === 'Setting nameservers at registrar...');
					return {
						...item,
						steps: [
							{ name: 'Creating domain zone...', status: 'success' },
							nsStep ? { ...nsStep } : null,
							{ name: 'Creating CNAME record (www)...', status: 'processing', variable: 'www -> @' }
						].filter(Boolean) as ConfigurationStep[]
					};
				}));

				try {
					const wwwRecord = await api.createDNSRecord(zone.id, {
						type: 'CNAME',
						name: 'www',
						content: '@',
						ttl: 1,
						proxied: proxied,
					});

					if (wwwRecord) {
						createdRecords.push(wwwRecord as DNSRecord);
						syncDNSCache(zone.id, createdRecords);
					}

					updateQueue(prev => prev.map(item => {
						if (item.domain !== domain) return item;
						const existingSteps = item.steps || [];
						const nsStep = existingSteps.find(s => s.name === 'Setting nameservers at registrar...');
						return {
							...item,
							steps: [
								{ name: 'Creating domain zone...', status: 'success' },
								nsStep ? { ...nsStep } : null,
								{ name: 'Creating CNAME record (www)...', status: 'success', variable: 'www -> @' }
							].filter(Boolean) as ConfigurationStep[]
						};
					}));
				} catch (error) {
					console.error(`Error creating www CNAME record for ${domain}:`, error);
					const errorMessage = formatCloudflareError(error);
					updateQueue(prev => prev.map(item => {
						if (item.domain !== domain) return item;
						const existingSteps = item.steps || [];
						const nsStep = existingSteps.find(s => s.name === 'Setting nameservers at registrar...');
						return {
							...item,
							steps: [
								{ name: 'Creating domain zone...', status: 'success' },
								nsStep ? { ...nsStep } : null,
								{
									name: 'Creating CNAME record (www)...',
									status: 'error',
									error: errorMessage,
									variable: 'www -> @'
								}
							].filter(Boolean) as ConfigurationStep[]
						};
					}));
				}
			}

			// Step 4: Create root A record if IP address is provided
			if (rootIPAddress.trim() && zone?.id) {
				updateQueue(prev => prev.map(item => {
					if (item.domain !== domain) return item;

					const existingSteps = item.steps || [];
					const nsStep = existingSteps.find(s => s.name === 'Setting nameservers at registrar...');
					const cnameStep = existingSteps.find(s => s.name === 'Creating CNAME record (www)...');
					const cnameStepStatus = cnameStep?.status || 'success';

					return {
						...item,
						steps: [
							{ name: 'Creating domain zone...', status: 'success' },
							nsStep ? { ...nsStep } : null,
							{ name: 'Creating CNAME record (www)...', status: cnameStepStatus, variable: 'www -> @' },
							{ name: 'Creating root A record...', status: 'processing' }
						].filter(Boolean) as ConfigurationStep[]
					};
				}));

				try {
					const rootRecord = await api.createDNSRecord(zone.id, {
						type: 'A',
						name: '@',
						content: rootIPAddress.trim(),
						ttl: 1,
						proxied: proxied,
					});

					if (rootRecord) {
						createdRecords.push(rootRecord as DNSRecord);
					}

					updateQueue(prev => prev.map(item => {
						if (item.domain !== domain) return item;

						const existingSteps = item.steps || [];
						const nsStep = existingSteps.find(s => s.name === 'Setting nameservers at registrar...');
						const cnameStep = existingSteps.find(s => s.name === 'Creating CNAME record (www)...');
						const cnameStepStatus = cnameStep?.status || 'success';

						return {
							...item,
							steps: [
								{ name: 'Creating domain zone...', status: 'success' },
								nsStep ? { ...nsStep } : null,
								{ name: 'Creating CNAME record (www)...', status: cnameStepStatus, variable: 'www -> @' },
								{ name: 'Creating root A record...', status: 'success' }
							].filter(Boolean) as ConfigurationStep[]
						};
					}));
				} catch (error) {
					console.error(`Error creating root A record for ${domain}:`, error);
					const errorMessage = formatCloudflareError(error);
					updateQueue(prev => prev.map(item => {
						if (item.domain !== domain) return item;

						const existingSteps = item.steps || [];
						const nsStep = existingSteps.find(s => s.name === 'Setting nameservers at registrar...');
						const cnameStep = existingSteps.find(s => s.name === 'Creating CNAME record (www)...');
						const cnameStepStatus = cnameStep?.status || 'success';

						return {
							...item,
							steps: [
								{ name: 'Creating domain zone...', status: 'success' },
								nsStep ? { ...nsStep } : null,
								{ name: 'Creating CNAME record (www)...', status: cnameStepStatus, variable: 'www -> @' },
								{
									name: 'Creating root A record...',
									status: 'error',
									error: errorMessage
								}
							].filter(Boolean) as ConfigurationStep[]
						};
					}));
				}

				syncDNSCache(zone.id, createdRecords);
			}

			// Step 5: Configure default zone settings
			if (zone?.id) {
				setIsConfiguring(true);

				const progressCallback: ZoneSettingsProgressCallback = (step) => {
					updateQueue(prev => prev.map(item => {
						if (item.domain !== domain) return item;

						const existingSteps = item.steps || [];
						const existingIndex = existingSteps.findIndex(s => s.name === step.name);

						let updatedSteps: ConfigurationStep[];
						if (existingIndex >= 0) {
							updatedSteps = [...existingSteps];
							updatedSteps[existingIndex] = {
								name: step.name,
								status: step.status,
								error: step.error,
								variable: step.variable,
							};
						} else {
							updatedSteps = [...existingSteps, {
								name: step.name,
								status: step.status,
								error: step.error,
								variable: step.variable,
							}];
						}

						return { ...item, steps: updatedSteps };
					}));
				};

				try {
					await api.configureDefaultZoneSettings(zone.id, progressCallback);
				} catch (configError) {
					console.error(`Error configuring settings for ${domain}:`, configError);
				}
			}

			// Mark domain as success
			updateQueue(prev => prev.map(item =>
				item.domain === domain
					? { ...item, status: 'success' }
					: item
			));

			if (zone?.id) {
				syncDNSCache(zone.id, createdRecords);
			}

			return { success: true };

		} catch (error) {
			console.error(`Error creating domain ${domain}:`, error);
			const errorMessage = formatCloudflareError(error);

			updateQueue(prev => prev.map(item =>
				item.domain === domain
					? {
						...item,
						status: 'error',
						// Only set domain-level error if there are no steps, otherwise error is shown at step level
						error: (item.steps?.length ?? 0) === 0 ? errorMessage : undefined,
						steps: item.steps?.map(s =>
							s.status === 'processing'
								? { ...s, status: 'error', error: errorMessage }
								: s
						) || []
					}
					: item
			));

			return { success: false };
		}
	};

	const processQueue = useCallback(async () => {
		// Prevent concurrent processing
		if (isProcessingRef.current) {
			return;
		}

		isProcessingRef.current = true;
		setIsCreating(true);
		setIsConfiguring(false);

		// Create abort controller for cancellation if not exists
		if (!abortControllerRef.current) {
			abortControllerRef.current = new AbortController();
		}
		const signal = abortControllerRef.current.signal;

		const api = new CloudflareAPI(account.apiToken);
		let successCount = 0;
		let errorCount = 0;

		// Process all pending domains
		while (true) {
			if (signal.aborted) {
				break;
			}

			// Get next pending domain from ref (synchronous read)
			const pendingItem = domainQueueRef.current.find(item => item.status === 'pending');

			if (!pendingItem) {
				break;
			}

			const result = await processDomain(pendingItem, api, signal);
			if (result.success) {
				successCount++;
			} else {
				errorCount++;
			}
		}

		isProcessingRef.current = false;
		setIsCreating(false);
		setIsConfiguring(false);

		// Refresh zones to show new domains
		if (successCount > 0 || errorCount > 0) {
			onSuccess();

			// Show summary toast
			if (successCount > 0 && errorCount === 0) {
				toast.success(`Successfully created ${successCount} domain${successCount > 1 ? 's' : ''}!`);
			} else if (successCount > 0 && errorCount > 0) {
				toast.warning(`Created ${successCount} domain${successCount > 1 ? 's' : ''}, ${errorCount} failed`);
			} else {
				toast.error(`Failed to create ${errorCount} domain${errorCount > 1 ? 's' : ''}`);
			}
		}
	}, [account, cloudflareAccountId, onSuccess, registrarAccountId, registrarAccounts, proxyAccounts]);

	const createDomains = async (
		domains: string[],
		rootIPAddress: string,
		proxied: boolean
	): Promise<void> => {
		// Append domains to queue instead of replacing
		const newQueueItems: DomainQueueItem[] = domains.map(domain => ({
			domain: domain.trim(),
			status: 'pending',
			steps: [],
			rootIPAddress: rootIPAddress.trim(),
			proxied: proxied,
		}));

		updateQueue(prev => {
			// Filter out duplicates and append new items
			const existingDomains = new Set(prev.map(item => item.domain));
			const uniqueNewItems = newQueueItems.filter(item => !existingDomains.has(item.domain));
			return [...prev, ...uniqueNewItems];
		});

		// Start processing if not already processing
		if (!isProcessingRef.current) {
			processQueue();
		}
	};

	const cancel = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		isProcessingRef.current = false;
		setIsCreating(false);
		setIsConfiguring(false);
	};

	const retryStep = async (domain: string | undefined, step: ConfigurationStep) => {
		if (!domain) return;

		const queueItem = domainQueueRef.current.find(item => item.domain === domain);
		if (!queueItem) return;

		const api = new CloudflareAPI(account.apiToken);

		const runSettingRetry = async (zoneId: string, name: string) => {
			const settingActions: Record<string, () => Promise<void>> = {
				'SSL mode': () => api.setSSLMode(zoneId, 'strict'),
				'Always use HTTPS': () => api.setAlwaysUseHTTPS(zoneId, true),
				'HSTS': () => api.setHSTS(zoneId, true),
				'TLS 1.3': () => api.setTLS13(zoneId, false),
				'Authenticated Origin Pulls': () => api.setAuthenticatedOriginPulls(zoneId, true),
				'Bot Fight Mode': () => api.setBotFightMode(zoneId, true),
				'AI Bots Protection': () => api.setAIBotsProtection(zoneId, 'disabled'),
				'WAF Custom Rule': () => api.createSkipBotsWAFRule(zoneId),
				'Early Hints': () => api.setEarlyHints(zoneId, true),
				'0-RTT': () => api.set0RTT(zoneId, true),
				'Pseudo IPv4': () => api.setPseudoIPv4(zoneId, 'overwrite_header'),
				'Email Obfuscation': () => api.setEmailObfuscation(zoneId, false),
			};

			const action = settingActions[name];
			if (!action) {
				throw new Error('Retry not available for this step');
			}

			setIsConfiguring(true);
			try {
				await action();
			} finally {
				setIsConfiguring(false);
			}
		};

		try {
			setDomainStatus(domain, 'processing');
			setStepState(domain, step.name, 'processing');

			if (step.name === 'Creating domain zone...') {
				const zone = await api.createZone(domain, cloudflareAccountId);

				updateQueue(prev => prev.map(item =>
					item.domain === domain
						? {
							...item,
							status: 'success',
							steps: [{ name: 'Creating domain zone...', status: 'success' }],
							nameservers: zone?.name_servers || [],
							zoneId: zone?.id,
						}
						: item
				));

				if (zone?.name_servers?.length) {
					setDomainNameservers(domain, zone.name_servers);
				}

				if (zone?.id) {
					addZone(zone, account.id, account.name || 'Unnamed Account');
				}

				return;
			}

			if (step.name === 'Creating CNAME record (www)...') {
				if (!queueItem.zoneId) {
					throw new Error('Zone not found. Retry zone creation first.');
				}

				await api.createDNSRecord(queueItem.zoneId, {
					type: 'CNAME',
					name: 'www',
					content: '@',
					ttl: 1,
					proxied: queueItem.proxied ?? true,
				});

				await refreshDNSRecords(queueItem.zoneId, api);
				setStepState(domain, step.name, 'success');
				setDomainStatus(domain, 'success');
				return;
			}

			if (step.name === 'Creating root A record...') {
				if (!queueItem.zoneId) {
					throw new Error('Zone not found. Retry zone creation first.');
				}

				if (!queueItem.rootIPAddress) {
					throw new Error('Root IP address not provided.');
				}

				await api.createDNSRecord(queueItem.zoneId, {
					type: 'A',
					name: '@',
					content: queueItem.rootIPAddress,
					ttl: 1,
					proxied: queueItem.proxied ?? true,
				});

				await refreshDNSRecords(queueItem.zoneId, api);
				setStepState(domain, step.name, 'success');
				setDomainStatus(domain, 'success');
				return;
			}

			if (step.name === 'Setting nameservers at registrar...') {
				if (!queueItem.nameservers?.length) {
					throw new Error('No Cloudflare nameservers found. Retry zone creation first.');
				}
				if (!registrarAccountId) {
					throw new Error('No registrar account selected.');
				}
				const regAccount = registrarAccounts.find((a) => a.id === registrarAccountId);
				if (!regAccount) throw new Error('Registrar account not found.');

				if (regAccount.registrarName === 'namecheap') {
					const proxy = proxyAccounts.find((p) => p.id === regAccount.proxyId);
					if (!proxy) throw new Error(`Proxy not found for Namecheap account ${regAccount.name || regAccount.email}`);

					const parts = domain.split('.');
					const tld = parts[parts.length - 1];
					const sld = parts.slice(0, -1).join('.');

					const headers: Record<string, string> = {
						'Content-Type': 'application/json',
						'x-account-id': regAccount.id,
						'x-api-user': regAccount.username || regAccount.email.split('@')[0].replaceAll('.', ''),
						'x-api-key': regAccount.apiToken,
						'x-proxy-host': proxy.host,
						'x-proxy-port': proxy.port?.toString() || '',
					};
					if (proxy.username) headers['x-proxy-username'] = proxy.username;
					if (proxy.password) headers['x-proxy-password'] = proxy.password;

					const resp = await fetch('/api/namecheap/nameservers', {
						method: 'POST',
						headers,
						body: JSON.stringify({ sld, tld, nameservers: queueItem.nameservers }),
					});
					const data = await resp.json();
					if (!resp.ok || !data.success) throw new Error(data.error || 'Failed to set nameservers');
				} else if (regAccount.registrarName === 'njalla') {
					const resp = await fetch('/api/njalla/nameservers', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'x-api-key': regAccount.apiToken,
						},
						body: JSON.stringify({ domain, nameservers: queueItem.nameservers }),
					});
					const data = await resp.json();
					if (!resp.ok || !data.success) throw new Error(data.error || 'Failed to set nameservers');
				}

				setStepState(domain, step.name, 'success');
				setDomainStatus(domain, 'success');
				return;
			}

			if (!queueItem.zoneId) {
				throw new Error('Zone not found. Retry zone creation first.');
			}

			await runSettingRetry(queueItem.zoneId, step.name);
			setStepState(domain, step.name, 'success');
			setDomainStatus(domain, 'success');
		} catch (error) {
			console.error(`Retry failed for ${domain} - ${step.name}:`, error);
			const errorMessage = formatCloudflareError(error);
			setStepState(domain, step.name, 'error', errorMessage);
			setDomainStatus(domain, 'error');
		}
	};

	const resetQueue = () => {
		cancel();
		updateQueue(() => []);
		setIsCreating(false);
		setIsConfiguring(false);
		isProcessingRef.current = false;
		abortControllerRef.current = null;
	};

	return {
		createDomains,
		cancel,
		resetQueue,
		retryStep,
		isCreating,
		isConfiguring,
		domainQueue,
	};
}

