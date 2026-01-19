import { useMemo } from 'react';
import type { ZoneWithDNS } from './use-domains-data';

export function useDomainsFilter(zones: ZoneWithDNS[], searchTerm: string, selectedAccount?: string) {

		return useMemo(() => {
				let filtered = zones;

				// Filter by account
				if (selectedAccount && selectedAccount !== 'all') {
						filtered = filtered.filter((item) => item.accountId === selectedAccount);
				}

				// Filter by search term
				if (!searchTerm) return filtered;

				const term = searchTerm.toLowerCase();

				return filtered.filter(item => {
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
		}, [zones, searchTerm, selectedAccount]);
}




