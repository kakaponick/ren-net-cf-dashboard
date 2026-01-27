import { useMemo } from 'react';
import type { ZoneWithDNS } from './use-domains-data';

export type SortField = 'name' | 'status' | 'account' | 'created' | 'rootARecord' | 'proxied' | 'sslTls';
export type SortDirection = 'asc' | 'desc';

export function useDomainsSort(zones: ZoneWithDNS[], sortField: SortField, sortDirection: SortDirection) {
		return useMemo(() => {
				return [...zones].sort((a, b) => {
						let aValue: any;
						let bValue: any;
						
						switch (sortField) {
								case 'name':
										aValue = a.zone.name.toLowerCase();
										bValue = b.zone.name.toLowerCase();
										break;
								case 'status':
										aValue = a.zone.status;
										bValue = b.zone.status;
										break;
								case 'account':
										aValue = a.accountEmail.toLowerCase();
										bValue = b.accountEmail.toLowerCase();
										break;
								case 'created':
										aValue = new Date(a.zone.created_on).getTime();
										bValue = new Date(b.zone.created_on).getTime();
										break;
								case 'rootARecord':
										aValue = a.rootARecords?.[0]?.content || '';
										bValue = b.rootARecords?.[0]?.content || '';
										break;
								case 'proxied':
										aValue = (a.rootARecords || []).some(r => r.proxied) ? 2 : (a.rootARecords?.length ? 1 : 0);
										bValue = (b.rootARecords || []).some(r => r.proxied) ? 2 : (b.rootARecords?.length ? 1 : 0);
										break;
								case 'sslTls':
										aValue = a.sslMode || 'strict';
										bValue = b.sslMode || 'strict';
										break;
								default:
										return 0;
						}
						
						if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
						if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
						return 0;
				});
		}, [zones, sortField, sortDirection]);
}




