import { useState } from 'react';
import { CloudflareAPI, type ZoneSettingsProgressCallback } from '@/lib/cloudflare-api';
import { useAccountStore } from '@/store/account-store';
import { toast } from 'sonner';
import { formatCloudflareError } from '@/lib/utils';
import type { ConfigurationStep } from '@/components/configuration-console';
import type { CloudflareAccount } from '@/types/cloudflare';

interface UseDomainCreationOptions {
	account: CloudflareAccount;
	cloudflareAccountId: string;
	onSuccess: () => void;
}

export function useDomainCreation({ account, cloudflareAccountId, onSuccess }: UseDomainCreationOptions) {
	const { setDomainNameservers } = useAccountStore();
	const [isCreating, setIsCreating] = useState(false);
	const [isConfiguring, setIsConfiguring] = useState(false);
	const [configurationSteps, setConfigurationSteps] = useState<ConfigurationStep[]>([]);
	const [createdNameservers, setCreatedNameservers] = useState<string[]>([]);

	const createDomain = async (
		domainName: string,
		rootIPAddress: string,
		proxied: boolean
	): Promise<void> => {
		setIsCreating(true);
		setConfigurationSteps([]);
		setIsConfiguring(false);
		setCreatedNameservers([]);

		try {
			const api = new CloudflareAPI(account.apiToken);

			// Step 1: Create zone
			setConfigurationSteps([{ name: 'Creating domain zone...', status: 'processing' }]);
			const zone = await api.createZone(domainName.trim(), cloudflareAccountId);
			setConfigurationSteps([{ name: 'Creating domain zone...', status: 'success' }]);

			// Save nameservers to store
			if (zone?.name_servers && Array.isArray(zone.name_servers) && zone.name_servers.length > 0) {
				setDomainNameservers(domainName.trim(), zone.name_servers);
				setCreatedNameservers(zone.name_servers);
			}

			// Step 2: Create CNAME record for www subdomain
			if (zone?.id) {
				setConfigurationSteps(prev => [...prev, { name: 'Creating CNAME record (www)...', status: 'processing', variable: 'www -> @' }]);
				try {
					await api.createDNSRecord(zone.id, {
						type: 'CNAME',
						name: 'www',
						content: '@',
						ttl: 1,
						proxied: proxied,
					});
					setConfigurationSteps(prev => prev.map(s =>
						s.name === 'Creating CNAME record (www)...'
							? { ...s, status: 'success' }
							: s
					));
				} catch (error) {
					console.error('Error creating www CNAME record:', error);
					const errorMessage = formatCloudflareError(error);
					setConfigurationSteps(prev => prev.map(s =>
						s.name === 'Creating CNAME record (www)...'
							? { ...s, status: 'error', error: errorMessage }
							: s
					));
					toast.warning('Domain created but failed to create www CNAME record. You can add it manually.');
				}
			}

			// Step 3: Create root A record if IP address is provided
			if (rootIPAddress.trim() && zone?.id) {
				setConfigurationSteps(prev => [...prev, { name: 'Creating root A record...', status: 'processing' }]);
				try {
					await api.createDNSRecord(zone.id, {
						type: 'A',
						name: '@',
						content: rootIPAddress.trim(),
						ttl: 1,
						proxied: proxied,
					});
					setConfigurationSteps(prev => prev.map(s =>
						s.name === 'Creating root A record...'
							? { ...s, status: 'success' }
							: s
					));
				} catch (error) {
					console.error('Error creating root A record:', error);
					const errorMessage = formatCloudflareError(error);
					setConfigurationSteps(prev => prev.map(s =>
						s.name === 'Creating root A record...'
							? { ...s, status: 'error', error: errorMessage }
							: s
					));
					toast.warning('Domain created but failed to create root A record. You can add it manually.');
				}
			}

			// Refresh zones immediately to show the new domain in the table
			onSuccess();

			// Step 4: Configure default zone settings
			if (zone?.id) {
				setIsConfiguring(true);
				setIsCreating(false);

				const progressCallback: ZoneSettingsProgressCallback = (step) => {
					setConfigurationSteps(prev => {
						const existingIndex = prev.findIndex(s => s.name === step.name);
						if (existingIndex >= 0) {
							const updated = [...prev];
							updated[existingIndex] = {
								name: step.name,
								status: step.status,
								error: step.error,
								variable: step.variable,
							};
							return updated;
						} else {
							return [...prev, {
								name: step.name,
								status: step.status,
								error: step.error,
								variable: step.variable,
							}];
						}
					});
				};

				try {
					const configResult = await api.configureDefaultZoneSettings(zone.id, progressCallback);
					setIsConfiguring(false);

					const domainNameTrimmed = domainName.trim();
					if (configResult.hasAuthError) {
						toast.success(`Domain "${domainNameTrimmed}" created successfully!`);
						toast.error('Failed to configure settings: Authentication error. Please check API token permissions.');
					} else if (configResult.failureCount === configResult.totalCount) {
						toast.success(`Domain "${domainNameTrimmed}" created successfully!`);
						toast.warning('Failed to configure default settings. Please configure them manually.');
					} else if (configResult.failureCount > 0) {
						toast.success(`Domain "${domainNameTrimmed}" created successfully!`);
						toast.warning(
							`Configured ${configResult.successCount}/${configResult.totalCount} settings. ` +
							`Failed: ${configResult.errors.join(', ')}`
						);
					} else {
						toast.success(`Domain "${domainNameTrimmed}" created and configured successfully!`);
					}
				} catch (configError) {
					setIsConfiguring(false);
					console.error('Error configuring default settings:', configError);
					toast.success(`Domain "${domainName.trim()}" created successfully!`);
					toast.error('Failed to configure default settings. Please configure them manually.');
				}
			} else {
				toast.success(`Domain "${domainName.trim()}" created successfully!`);
			}
		} catch (error) {
			console.error('Error creating domain:', error);
			const errorMessage = formatCloudflareError(error);
			toast.error(errorMessage);
			setCreatedNameservers([]);
			setConfigurationSteps(prev => prev.map(s =>
				s.status === 'processing'
					? { ...s, status: 'error', error: errorMessage }
					: s
			));
			throw error;
		} finally {
			setIsCreating(false);
			setIsConfiguring(false);
		}
	};

	return {
		createDomain,
		isCreating,
		isConfiguring,
		configurationSteps,
		createdNameservers,
	};
}

