'use client';

import { useEffect } from 'react';
import { useAccountStore } from '@/store/account-store';
import Layout from '@/components/layout';
import DomainsPage from '@/views/domains';

export default function Domains() {
		const { loadAccounts } = useAccountStore();
		
		useEffect(() => {
				loadAccounts();
		}, [loadAccounts]);

		return (
				<div className="min-h-screen bg-background">
						<Layout>
								<DomainsPage />
						</Layout>
				</div>
		);
}

