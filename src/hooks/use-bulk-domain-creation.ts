import { useState, useRef } from 'react';
import { CloudflareAPI, type ZoneSettingsProgressCallback } from '@/lib/cloudflare-api';
import { useAccountStore } from '@/store/account-store';
import { toast } from 'sonner';
import type { DomainQueueItem, ConfigurationStep } from '@/components/configuration-console';
import type { CloudflareAccount } from '@/types/cloudflare';

interface UseBulkDomainCreationOptions {
	account: CloudflareAccount;
	cloudflareAccountId: string;
	onSuccess: () => void;
}

export function useBulkDomainCreation({ account, cloudflareAccountId, onSuccess }: UseBulkDomainCreationOptions) {
	const { setDomainNameservers } = useAccountStore();
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

				// Step 2: Create root A record if IP address is provided
				if (rootIPAddress.trim() && zone?.id) {
					setDomainQueue(prev => prev.map(item =>
						item.domain === domain
							? {
								...item,
								steps: [
									{ name: 'Creating domain zone...', status: 'success' },
									{ name: 'Creating root A record...', status: 'processing' }
								]
							}
							: item
					));

					try {
						await api.createDNSRecord(zone.id, {
							type: 'A',
							name: '@',
							content: rootIPAddress.trim(),
							ttl: 1,
							proxied: proxied,
						});

						setDomainQueue(prev => prev.map(item =>
							item.domain === domain
								? {
									...item,
									steps: [
										{ name: 'Creating domain zone...', status: 'success' },
										{ name: 'Creating root A record...', status: 'success' }
									]
								}
								: item
						));
					} catch (error) {
						console.error(`Error creating root A record for ${domain}:`, error);
						setDomainQueue(prev => prev.map(item =>
							item.domain === domain
								? {
									...item,
									steps: [
										{ name: 'Creating domain zone...', status: 'success' },
										{
											name: 'Creating root A record...',
											status: 'error',
											error: error instanceof Error ? error.message : 'Failed to create root A record'
										}
									]
								}
								: item
						));
					}
				}

				// Step 3: Configure default zone settings
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
								};
							} else {
								updatedSteps = [...existingSteps, {
									name: step.name,
									status: step.status,
									error: step.error,
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
				const errorMessage = error instanceof Error ? error.message : 'Failed to create domain';

				setDomainQueue(prev => prev.map(item =>
					item.domain === domain
						? {
							...item,
							status: 'error',
							error: errorMessage,
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
			toast.success(`Successfully created ${successCount} domain${successCount > 1 ? 's' : ''}!`, { duration: Infinity });
		} else if (successCount > 0 && errorCount > 0) {
			toast.warning(`Created ${successCount} domain${successCount > 1 ? 's' : ''}, ${errorCount} failed`, { duration: Infinity });
		} else {
			toast.error(`Failed to create ${errorCount} domain${errorCount > 1 ? 's' : ''}`, { duration: Infinity });
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

