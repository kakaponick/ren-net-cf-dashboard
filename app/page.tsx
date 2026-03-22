'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/store/account-store';
import DomainsPage from '@/views/domains';

export default function Home() {
		const { loadAccounts, loadProxyAccounts } = useAccountStore();

		useEffect(() => {
				loadAccounts();
				loadProxyAccounts();
		}, [loadAccounts, loadProxyAccounts]);

		return <DomainsPage />;
}

