import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DomainHealthResult } from '@/types/domain-health';

interface DomainHealthState {
		healthByDomain: Record<string, DomainHealthResult>;
		errorByDomain: Record<string, string>;
		setHealthResult: (domain: string, result: DomainHealthResult) => void;
		setHealthError: (domain: string, message: string) => void;
		clearDomain: (domain: string) => void;
		clearAll: () => void;
}

export const useDomainHealthStore = create<DomainHealthState>()(
		persist(
				(set) => ({
						healthByDomain: {},
						errorByDomain: {},
						setHealthResult: (domain, result) =>
								set((state) => ({
										healthByDomain: { ...state.healthByDomain, [domain]: result },
										errorByDomain: { ...state.errorByDomain, [domain]: '' },
								})),
						setHealthError: (domain, message) =>
								set((state) => ({
										errorByDomain: { ...state.errorByDomain, [domain]: message },
								})),
						clearDomain: (domain) =>
								set((state) => {
										const nextHealth = { ...state.healthByDomain };
										const nextErrors = { ...state.errorByDomain };
										delete nextHealth[domain];
										delete nextErrors[domain];
										return {
												healthByDomain: nextHealth,
												errorByDomain: nextErrors,
										};
								}),
						clearAll: () =>
								set(() => ({
										healthByDomain: {},
										errorByDomain: {},
								})),
				}),
				{
						name: 'domain-health-store',
						partialize: (state) => ({
								healthByDomain: state.healthByDomain,
								errorByDomain: state.errorByDomain,
						}),
				}
		)
);

