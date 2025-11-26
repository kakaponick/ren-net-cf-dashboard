import { useState } from 'react';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { useAccountStore } from '@/store/account-store';
import { validateIPAddress } from '@/lib/utils';
import { toast } from 'sonner';
import type { DNSRecord } from '@/types/cloudflare';

interface UseRootARecordOptions {
	zoneId?: string;
	accountId?: string;
	onSuccess?: (zoneId: string, accountId: string) => void;
}

export function useRootARecord({ zoneId, accountId, onSuccess }: UseRootARecordOptions) {
	const [isProcessing, setIsProcessing] = useState(false);
	const { accounts } = useAccountStore();

	const validateInputs = (ipAddress: string): string | null => {
		if (!ipAddress.trim()) {
			return 'Please enter an IP address';
		}

		if (!validateIPAddress(ipAddress.trim())) {
			return 'Please enter a valid IPv4 address';
		}

		if (!zoneId || !accountId) {
			return 'Missing zone or account information';
		}

		const account = accounts.find(acc => acc.id === accountId);
		if (!account) {
			return 'Account not found';
		}

		return null;
	};

	const createRecord = async (ipAddress: string, proxied: boolean) => {
		const error = validateInputs(ipAddress);
		if (error) {
			toast.error(error);
			return false;
		}

		const account = accounts.find(acc => acc.id === accountId)!;
		setIsProcessing(true);

		try {
			const api = new CloudflareAPI(account.apiToken);
			await api.createDNSRecord(zoneId!, {
				type: 'A',
				name: '@',
				content: ipAddress.trim(),
				ttl: 1,
				proxied,
			});

			toast.success('Root A record created successfully');
			onSuccess?.(zoneId!, accountId!);
			return true;
		} catch (error) {
			console.error('Error creating root A record:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to create root A record';
			toast.error(errorMessage);
			return false;
		} finally {
			setIsProcessing(false);
		}
	};

	const updateRecord = async (recordId: string, ipAddress: string, proxied: boolean) => {
		const error = validateInputs(ipAddress);
		if (error) {
			toast.error(error);
			return false;
		}

		const account = accounts.find(acc => acc.id === accountId)!;
		setIsProcessing(true);

		try {
			const api = new CloudflareAPI(account.apiToken);
			await api.updateDNSRecord(zoneId!, recordId, {
				type: 'A',
				name: '@',
				content: ipAddress.trim(),
				ttl: 1,
				proxied,
			});

			toast.success('Root A record updated successfully');
			onSuccess?.(zoneId!, accountId!);
			return true;
		} catch (error) {
			console.error('Error updating root A record:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to update root A record';
			toast.error(errorMessage);
			return false;
		} finally {
			setIsProcessing(false);
		}
	};

	const canEdit = Boolean(zoneId && accountId);

	return {
		createRecord,
		updateRecord,
		isProcessing,
		canEdit,
	};
}

