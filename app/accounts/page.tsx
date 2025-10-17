'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/store/account-store';
import AccountsPage from '@/views/accounts';

export default function Accounts() {
	const { loadAccounts } = useAccountStore();

	useEffect(() => {
		loadAccounts();
	}, [loadAccounts]);

	return (
		<div className="min-h-screen bg-background">
			<AccountsPage />
		</div>
	);
}

