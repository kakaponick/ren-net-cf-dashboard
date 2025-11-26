import { useState, useRef } from 'react';
import { CloudflareAPI, type ZoneSettingsProgressCallback } from '@/lib/cloudflare-api';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { toast } from 'sonner';
import { formatCloudflareError } from '@/lib/utils';
import type { DomainQueueItem, ConfigurationStep } from '@/components/configuration-console';
import type { CloudflareAccount } from '@/types/cloudflare';

interface UseBulkDomainCreationOptions {
	account: CloudflareAccount;
	cloudflareAccountId: string;
	onSuccess: () => void;
}

export function useBulkDomainCreation({ account, cloudflareAccountId, onSuccess }: UseBulkDomainCreationOptions) {
	const { setDomainNameservers } = useAccountStore();
	const { addZone } = useCloudflareCache();
	const [isCreating, setIsCreating] = useState(false);
	const [isConfiguring, setIsConfiguring] = useState(false);
	const [domainQueue, setDomainQueue] = useState<DomainQueueItem[]>([]);
	const abortControllerRef = useRef<AbortController | null>(null);

	const createDomains = async (
		domains: string[],
		rootIPAddress: string,
		proxied: boolean
	): Promise<void> => {
		// Initialize domain queue
		const initialQueue: DomainQueueItem[] = domains.map(domain => ({
			domain: domain.trim(),
			status: 'pending',
			steps: [],
		}));
		setDomainQueue(initialQueue);
		setIsCreating(true);
		setIsConfiguring(false);

		// Create abort controller for cancellation
		abortControllerRef.current = new AbortController();
		const signal = abortControllerRef.current.signal;

		const api = new CloudflareAPI(account.apiToken);
		let successCount = 0;
		let errorCount = 0;

		// Process domains sequentially to avoid rate limits
		for (let i = 0; i < domains.length; i++) {
			if (signal.aborted) {
				break;
			}

			const domain = domains[i].trim();

			// Update domain status to processing
			setDomainQueue(prev => prev.map(item =>
				item.domain === domain
					? { ...item, status: 'processing', steps: [{ name: 'Creating domain zone...', status: 'processing' }] }
					: item
			));

			try {
				// Step 1: Create zone
				const zone = await api.createZone(domain, cloudflareAccountId);

				// Add zone to cache immediately for reactive UI update
				if (zone?.id) {
					addZone(zone, account.id, account.name);
				}

				// Update step to success
				setDomainQueue(prev => prev.map(item =>
					item.domain === domain
						? {
							...item,
							steps: [{ name: 'Creating domain zone...', status: 'success' }],
							nameservers: zone?.name_servers || []
						}
						: item
				));

				// Save nameservers to store
				if (zone?.name_servers && Array.isArray(zone.name_servers) && zone.name_servers.length > 0) {
					setDomainNameservers(domain, zone.name_servers);
				}

				// Step 2: Create CNAME record for www subdomain
				if (zone?.id) {
					setDomainQueue(prev => prev.map(item =>
						item.domain === domain
							? {
								...item,
								steps: [
									{ name: 'Creating domain zone...', status: 'success' },
									{ name: 'Creating CNAME record (www)...', status: 'processing', variable: 'www -> @' }
								]
							}
							: item
					));

					try {
						await api.createDNSRecord(zone.id, {
							type: 'CNAME',
							name: 'www',
							content: '@',
							ttl: 1,
							proxied: proxied,
						});

						setDomainQueue(prev => prev.map(item =>
							item.domain === domain
								? {
									...item,
									steps: [
										{ name: 'Creating domain zone...', status: 'success' },
										{ name: 'Creating CNAME record (www)...', status: 'success', variable: 'www -> @' }
									]
								}
								: item
						));
					} catch (error) {
						console.error(`Error creating www CNAME record for ${domain}:`, error);
						const errorMessage = formatCloudflareError(error);
						setDomainQueue(prev => prev.map(item =>
							item.domain === domain
								? {
									...item,
									steps: [
										{ name: 'Creating domain zone...', status: 'success' },
										{
											name: 'Creating CNAME record (www)...',
											status: 'error',
											error: errorMessage,
											variable: 'www -> @'
										}
									]
								}
								: item
						));
					}
				}

				// Step 3: Create root A record if IP address is provided
				if (rootIPAddress.trim() && zone?.id) {
					setDomainQueue(prev => prev.map(item => {
						if (item.domain !== domain) return item;
						
						const existingSteps = item.steps || [];
						const cnameStep = existingSteps.find(s => s.name === 'Creating CNAME record (www)...');
						const cnameStepStatus = cnameStep?.status || 'success';
						
						return {
							...item,
							steps: [
								{ name: 'Creating domain zone...', status: 'success' },
								{ name: 'Creating CNAME record (www)...', status: cnameStepStatus, variable: 'www -> @' },
								{ name: 'Creating root A record...', status: 'processing' }
							]
						};
					}));

					try {
						await api.createDNSRecord(zone.id, {
							type: 'A',
							name: '@',
							content: rootIPAddress.trim(),
							ttl: 1,
							proxied: proxied,
						});

						setDomainQueue(prev => prev.map(item => {
							if (item.domain !== domain) return item;
							
							const existingSteps = item.steps || [];
							const cnameStep = existingSteps.find(s => s.name === 'Creating CNAME record (www)...');
							const cnameStepStatus = cnameStep?.status || 'success';
							
							return {
								...item,
								steps: [
									{ name: 'Creating domain zone...', status: 'success' },
									{ name: 'Creating CNAME record (www)...', status: cnameStepStatus, variable: 'www -> @' },
									{ name: 'Creating root A record...', status: 'success' }
								]
							};
						}));
					} catch (error) {
						console.error(`Error creating root A record for ${domain}:`, error);
						const errorMessage = formatCloudflareError(error);
						setDomainQueue(prev => prev.map(item => {
							if (item.domain !== domain) return item;
							
							const existingSteps = item.steps || [];
							const cnameStep = existingSteps.find(s => s.name === 'Creating CNAME record (www)...');
							const cnameStepStatus = cnameStep?.status || 'success';
							
							return {
								...item,
								steps: [
									{ name: 'Creating domain zone...', status: 'success' },
									{ name: 'Creating CNAME record (www)...', status: cnameStepStatus, variable: 'www -> @' },
									{
										name: 'Creating root A record...',
										status: 'error',
										error: errorMessage
									}
								]
							};
						}));
					}
				}

				// Step 4: Configure default zone settings
				if (zone?.id) {
					setIsConfiguring(true);

					const progressCallback: ZoneSettingsProgressCallback = (step) => {
						setDomainQueue(prev => prev.map(item => {
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
				setDomainQueue(prev => prev.map(item =>
					item.domain === domain
						? { ...item, status: 'success' }
						: item
				));
				successCount++;

			} catch (error) {
				console.error(`Error creating domain ${domain}:`, error);
				const errorMessage = formatCloudflareError(error);

				setDomainQueue(prev => prev.map(item =>
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
				errorCount++;
			}

			// Small delay between domains to avoid rate limits
			if (i < domains.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}
		}

		setIsCreating(false);
		setIsConfiguring(false);

		// Refresh zones to show new domains
		onSuccess();

		// Show summary toast
		if (successCount > 0 && errorCount === 0) {
			toast.success(`Successfully created ${successCount} domain${successCount > 1 ? 's' : ''}!`);
		} else if (successCount > 0 && errorCount > 0) {
			toast.warning(`Created ${successCount} domain${successCount > 1 ? 's' : ''}, ${errorCount} failed`);
		} else {
			toast.error(`Failed to create ${errorCount} domain${errorCount > 1 ? 's' : ''}`);
		}
	};

	const cancel = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
	};

	return {
		createDomains,
		cancel,
		isCreating,
		isConfiguring,
		domainQueue,
	};
}

