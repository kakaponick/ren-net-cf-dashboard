import { useMemo } from 'react';
import type { ZoneWithDNS } from './use-domains-data';

export function useDomainsFilter(zones: ZoneWithDNS[], searchTerm: string) {
		return useMemo(() => {
				if (!searchTerm) return zones;

				const term = searchTerm.toLowerCase();
				
				return zones.filter(item => 
						item.zone.name.toLowerCase().includes(term) ||
						item.accountName.toLowerCase().includes(term) ||
						item.accountEmail.toLowerCase().includes(term) ||
						// Search in A record IPs
						item.rootARecords?.some(record => 
								record.content.toLowerCase().includes(term)
						)
				);
		}, [zones, searchTerm]);
}




