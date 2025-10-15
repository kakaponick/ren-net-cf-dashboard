import { useMemo } from 'react';
import type { ZoneWithDNS } from './use-domains-data';

export function useDomainsFilter(zones: ZoneWithDNS[], searchTerm: string) {
		return useMemo(() => {
				if (!searchTerm) return zones;

				return zones.filter(item => 
						item.zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
						item.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
						item.accountEmail.toLowerCase().includes(searchTerm.toLowerCase())
				);
		}, [zones, searchTerm]);
}




