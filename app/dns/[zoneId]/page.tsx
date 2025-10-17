'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/store/account-store';
import Layout from '@/components/layout';
import DNSRecordsPage from '@/views/dns-records';

export default function DNSRecords() {
		const { loadAccounts } = useAccountStore();
		
		useEffect(() => {
				loadAccounts();
		}, [loadAccounts]);

		return (
				<div className="min-h-screen bg-background">
						<Layout>
								<DNSRecordsPage />
						</Layout>
				</div>
		);
}

