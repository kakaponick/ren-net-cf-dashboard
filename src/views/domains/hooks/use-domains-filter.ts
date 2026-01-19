import { useMemo } from 'react';
import type { ZoneWithDNS } from './use-domains-data';

export function useDomainsFilter(zones: ZoneWithDNS[], searchTerm: string) {

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

						return false;
				});
		}, [zones, searchTerm]);
}




