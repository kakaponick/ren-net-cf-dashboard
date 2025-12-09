import { useMemo } from 'react';
import { useDomainHealthStore } from '@/store/domain-health-store';
import type { ZoneWithDNS } from './use-domains-data';

export type SortField = 'name' | 'status' | 'account' | 'created' | 'rootARecord' | 'proxied' | 'expiration' | 'health';
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
								case 'expiration': {
										const aExpiry = a.zone?.name ? useDomainHealthStore.getState().healthByDomain[a.zone.name]?.whois.expirationDate : null;
										const bExpiry = b.zone?.name ? useDomainHealthStore.getState().healthByDomain[b.zone.name]?.whois.expirationDate : null;
										aValue = aExpiry ? new Date(aExpiry).getTime() : Number.POSITIVE_INFINITY;
										bValue = bExpiry ? new Date(bExpiry).getTime() : Number.POSITIVE_INFINITY;
										break;
								}
								case 'health': {
										const healthStore = useDomainHealthStore.getState().healthByDomain;
										const rank = (status?: string) => {
												if (status === 'error') return 0;
												if (status === 'warning') return 1;
												if (status === 'healthy') return 2;
												return 3;
										};
										const aStatus = a.zone?.name ? healthStore[a.zone.name]?.http.status || healthStore[a.zone.name]?.status : undefined;
										const bStatus = b.zone?.name ? healthStore[b.zone.name]?.http.status || healthStore[b.zone.name]?.status : undefined;
										aValue = rank(aStatus);
										bValue = rank(bStatus);
										break;
								}
								default:
										return 0;
						}
						
						if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
						if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
						return 0;
				});
		}, [zones, sortField, sortDirection]);
}




