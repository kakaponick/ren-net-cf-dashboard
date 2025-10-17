'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/store/account-store';

import DNSRecordsPage from '@/views/dns-records';

export default function DNSRecords() {
	const { loadAccounts } = useAccountStore();

	useEffect(() => {
		loadAccounts();
	}, [loadAccounts]);

	return (
		<div className="min-h-screen bg-background">
			<DNSRecordsPage />
		</div>
	);
}

