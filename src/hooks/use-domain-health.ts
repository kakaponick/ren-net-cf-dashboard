'use client';

import { useCallback, useMemo, useState } from 'react';
import type { HealthStatus } from '@/types/domain-health';
import { useDomainHealthStore } from '@/store/domain-health-store';

export function useDomainHealth(domain: string) {
		const health = useDomainHealthStore(
				useCallback((state) => state.healthByDomain[domain] ?? null, [domain])
		);
		const error = useDomainHealthStore(
				useCallback((state) => state.errorByDomain[domain] || null, [domain])
		);
		const setHealthResult = useDomainHealthStore((state) => state.setHealthResult);
		const setHealthError = useDomainHealthStore((state) => state.setHealthError);

		const [isChecking, setIsChecking] = useState(false);

		const status: HealthStatus | null = useMemo(() => health?.status ?? null, [health]);

		const checkHealth = useCallback(
				async (forceRefresh = false) => {
						if (!forceRefresh && health) {
								return health;
						}

						setIsChecking(true);
						try {
								const response = await fetch(`/api/domain-health?domain=${encodeURIComponent(domain)}`);
								const data = await response.json();

								if (!response.ok) {
										const message = data?.error || 'Health check failed';
										throw new Error(message);
								}

								setHealthResult(domain, data);
								setHealthError(domain, '');
								return data;
						} catch (err) {
								const message = err instanceof Error ? err.message : 'Failed to check domain health';
								setHealthError(domain, message);
								throw err;
						} finally {
								setIsChecking(false);
						}
				},
				[domain, health, setHealthError, setHealthResult]
		);

		return {
				health,
				error,
				status,
				isChecking,
				checkHealth
		};
}

