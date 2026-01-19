import { useState, useMemo, useEffect } from 'react';
import type { NamecheapDomain } from '@/types/namecheap';

type SortField = 'name' | 'user' | 'created' | 'expires' | 'status';
type SortDirection = 'asc' | 'desc';

const DEBOUNCE_DELAY = 200;

const STATUS_ORDER = { Active: 0, Locked: 1, Expired: 2 } as const;

function getDomainStatus(domain: NamecheapDomain): keyof typeof STATUS_ORDER {
	if (domain.IsExpired) return 'Expired';
	if (domain.IsLocked) return 'Locked';
	return 'Active';
}

export function useRegistrarFilterSort(domains: NamecheapDomain[]) {
	const [searchTerm, setSearchTerm] = useState('');
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
	const [selectedAccount, setSelectedAccount] = useState('all');
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

		// Filter by account
		if (selectedAccount !== 'all') {
			result = result.filter((d) => d.accountId === selectedAccount);
		}

		// Filter by search term
		if (debouncedSearchTerm) {
			const lowerSearch = debouncedSearchTerm.toLowerCase();
			result = result.filter(
				(domain) =>
					domain.Name.toLowerCase().includes(lowerSearch) ||
					domain.User.toLowerCase().includes(lowerSearch)
			);
		}

		return result;
	}, [domains, debouncedSearchTerm, selectedAccount]);

	const sortedDomains = useMemo(() => {
		return [...filteredDomains].sort((a, b) => {
			let aValue: string | number;
			let bValue: string | number;

			switch (sortField) {
				case 'name':
					aValue = a.Name.toLowerCase();
					bValue = b.Name.toLowerCase();
					break;
				case 'user':
					aValue = a.User.toLowerCase();
					bValue = b.User.toLowerCase();
					break;
				case 'created':
					aValue = new Date(a.Created).getTime();
					bValue = new Date(b.Created).getTime();
					break;
				case 'expires':
					aValue = new Date(a.Expires).getTime();
					bValue = new Date(b.Expires).getTime();
					break;
				case 'status':
					aValue = STATUS_ORDER[getDomainStatus(a)];
					bValue = STATUS_ORDER[getDomainStatus(b)];
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
		sortField,
		sortDirection,
		handleSort,
		sortedDomains,
	};
}
