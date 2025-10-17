'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/store/account-store';
import SSLCertificatesPage from '@/views/ssl-certificates';

export default function SSLCertificates() {
	const { loadAccounts } = useAccountStore();

	useEffect(() => {
		loadAccounts();
	}, [loadAccounts]);

	return (
		<div className="min-h-screen bg-background">
			<SSLCertificatesPage />
		</div>
	);
}

