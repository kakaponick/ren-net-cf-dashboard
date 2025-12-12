import { useMemo } from 'react';
import { useDomainHealthStore } from '@/store/domain-health-store';
import type { ZoneWithDNS } from './use-domains-data';

export function useDomainsFilter(zones: ZoneWithDNS[], searchTerm: string) {
		const { healthByDomain, errorByDomain } = useDomainHealthStore();

		return useMemo(() => {
				if (!searchTerm) return zones;

				const term = searchTerm.toLowerCase();

				return zones.filter(item => {
						// Search domain name
						if (item.zone.name.toLowerCase().includes(term)) return true;

						// Search account name/email
						if (item.accountName.toLowerCase().includes(term)) return true;
						if (item.accountEmail.toLowerCase().includes(term)) return true;

						// Search in A record IPs
						if (item.rootARecords?.some(record =>
								record.content.toLowerCase().includes(term)
						)) return true;

						// Search health status
						const health = healthByDomain[item.zone.name];
						const healthError = errorByDomain[item.zone.name];

						if (health) {
								const status = health.http.status;
								
								// Status labels mapping
								const statusLabels = {
										healthy: 'healthy',
										warning: 'attention',
										error: 'unhealthy'
								};
								
								const statusLabel = statusLabels[status]?.toLowerCase();
								
								// Check if status label starts with the search term
								// This prevents "healthy" from matching "unhealthy" (substring issue)
								// Supports both exact matches ("healthy") and partial matches ("heal")
								if (statusLabel && statusLabel.startsWith(term)) return true;
								
								// Also check for status code keywords
								if (term === 'warning' && status === 'warning') return true;
								if (term === 'error' && status === 'error') return true;

								// Search by HTTP reachability
								if (term.includes('reachable') && health.http.reachable) return true;
								if (term.includes('unreachable') && !health.http.reachable) return true;

								// Search by HTTP status code
								if (health.http.statusCode && health.http.statusCode.toString().includes(term)) return true;
						}

						// Search by health error messages
						if (healthError && healthError.toLowerCase().includes(term)) return true;

						return false;
				});
		}, [zones, searchTerm, healthByDomain, errorByDomain]);
}




