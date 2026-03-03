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

		const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
		if (terms.length === 0) return filtered;

		const matchesTerm = (item: ZoneWithDNS, term: string) => {
			if (item.zone.name.toLowerCase().includes(term)) return true;
			if (item.accountName.toLowerCase().includes(term)) return true;
			if (item.accountEmail.toLowerCase().includes(term)) return true;
			if (item.rootARecords?.some(record =>
				record.content.toLowerCase().includes(term)
			)) return true;
			return false;
		};

		// Multiple terms → show zones matching ANY term (OR logic)
		// Lets users paste space-separated domain lists to filter
		return filtered.filter(item =>
			terms.some(term => matchesTerm(item, term))
		);
	}, [zones, searchTerm, selectedAccount]);
}




