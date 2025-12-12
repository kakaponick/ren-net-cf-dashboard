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
								// Search by status keywords
								if (term.includes('healthy') && status === 'healthy') return true;
								if (term.includes('unhealthy') && status === 'error') return true;
								if (term.includes('attention') && status === 'warning') return true;
								if (term.includes('error') && status === 'error') return true;
								if (term.includes('warning') && status === 'warning') return true;

								// Search by status label
								const statusLabels = {
										healthy: 'healthy',
										warning: 'attention',
										error: 'unhealthy'
								};
								if (statusLabels[status]?.toLowerCase().includes(term)) return true;

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




