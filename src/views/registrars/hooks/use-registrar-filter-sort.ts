import { useState, useMemo, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { UnifiedDomain, RegistrarType } from '@/types/registrar';

type SortField = 'name' | 'registrar' | 'expires' | 'status' | 'email';
type SortDirection = 'asc' | 'desc';

const DEBOUNCE_DELAY = 200;

const STATUS_ORDER = { Active: 0, Locked: 1, Inactive: 2, Expired: 3 } as const;

function getDomainStatus(domain: UnifiedDomain): keyof typeof STATUS_ORDER {
	const statusMap: Record<string, keyof typeof STATUS_ORDER> = {
		active: 'Active',
		locked: 'Locked',
		inactive: 'Inactive',
		expired: 'Expired',
	};
	return statusMap[domain.status] || 'Active';
}

export function useRegistrarFilterSort(domains: UnifiedDomain[], accountEmails: Record<string, string> = {}) {
	const [searchTerm, setSearchTerm] = useLocalStorage<string>('registrar-search-term', '');
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
	const [selectedAccount, setSelectedAccount] = useLocalStorage<string>('registrar-account-filter', 'all');
	const [selectedRegistrar, setSelectedRegistrar] = useLocalStorage<RegistrarType | 'all'>('registrar-type-filter', 'all');
	const [sortField, setSortField] = useState<SortField>('name');
	const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchTerm(searchTerm);
		}, DEBOUNCE_DELAY);

		return () => clearTimeout(timer);
	}, [searchTerm]);

	const filteredDomains = useMemo(() => {
		let result = domains;

		// Filter by registrar type
		if (selectedRegistrar !== 'all') {
			result = result.filter((d) => d.registrar === selectedRegistrar);
		}

		// Filter by account
		if (selectedAccount !== 'all') {
			result = result.filter((d) => d.accountId === selectedAccount);
		}

		// Filter by search term
		if (debouncedSearchTerm) {
			const lowerSearch = debouncedSearchTerm.toLowerCase();
			result = result.filter(
				(domain) =>
					domain.name.toLowerCase().includes(lowerSearch) ||
					(accountEmails[domain.accountId] || '').toLowerCase().includes(lowerSearch)
			);
		}

		return result;
	}, [domains, debouncedSearchTerm, selectedAccount, selectedRegistrar]);

	const sortedDomains = useMemo(() => {
		return [...filteredDomains].sort((a, b) => {
			let aValue: string | number;
			let bValue: string | number;

			switch (sortField) {
				case 'name':
					aValue = a.name.toLowerCase();
					bValue = b.name.toLowerCase();
					break;
				case 'registrar':
					aValue = a.registrar.toLowerCase();
					bValue = b.registrar.toLowerCase();
					break;
				case 'expires':
					aValue = new Date(a.expiry).getTime();
					bValue = new Date(b.expiry).getTime();
					break;
				case 'status':
					aValue = STATUS_ORDER[getDomainStatus(a)];
					bValue = STATUS_ORDER[getDomainStatus(b)];
					break;
				case 'email':
					aValue = (accountEmails[a.accountId] || '').toLowerCase();
					bValue = (accountEmails[b.accountId] || '').toLowerCase();
					break;
				default:
					return 0;
			}

			if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
			if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	}, [filteredDomains, sortField, sortDirection]);

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortField(field);
			setSortDirection('asc');
		}
	};

	const clearSearch = () => setSearchTerm('');

	return {
		searchTerm,
		setSearchTerm,
		clearSearch,
		selectedAccount,
		setSelectedAccount,
		selectedRegistrar,
		setSelectedRegistrar,
		sortField,
		sortDirection,
		handleSort,
		sortedDomains,
	};
}
