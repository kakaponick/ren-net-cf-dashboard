import { useEffect, useMemo, useState } from 'react';
import type { CloudflareAccount } from '@/types/cloudflare';
import { useCloudflareAccounts } from '@/hooks/use-cloudflare-accounts';

interface UseCloudflareDestinationAccountOptions {
  selectedAccountId: string;
  accounts?: CloudflareAccount[];
}

export function useCloudflareDestinationAccount({
  selectedAccountId,
  accounts = [],
}: UseCloudflareDestinationAccountOptions) {
  const [selectedCloudflareAccountId, setSelectedCloudflareAccountId] = useState('');
  const {
    accountsToUse,
    selectedAccount,
    cloudflareAccounts,
    isLoadingAccounts,
  } = useCloudflareAccounts({
    selectedAccountId,
    accounts,
  });

  useEffect(() => {
    if (!selectedAccountId) {
      setSelectedCloudflareAccountId('');
      return;
    }

    if (isLoadingAccounts) {
      return;
    }

    const isCurrentSelectionValid = cloudflareAccounts.some(
      (account) => account.id === selectedCloudflareAccountId
    );

    if (cloudflareAccounts.length === 1) {
      const onlyAccountId = cloudflareAccounts[0].id;
      if (selectedCloudflareAccountId !== onlyAccountId) {
        setSelectedCloudflareAccountId(onlyAccountId);
      }
      return;
    }

    if (!isCurrentSelectionValid && selectedCloudflareAccountId) {
      setSelectedCloudflareAccountId('');
    }
  }, [selectedAccountId, cloudflareAccounts, isLoadingAccounts, selectedCloudflareAccountId]);

  const selectedCloudflareAccount = useMemo(
    () => cloudflareAccounts.find((account) => account.id === selectedCloudflareAccountId),
    [cloudflareAccounts, selectedCloudflareAccountId]
  );

  const destinationAccountMessage = useMemo(() => {
    if (!selectedAccountId) {
      return 'Select a Cloudflare API credential first.';
    }

    if (isLoadingAccounts) {
      return 'Loading Cloudflare accounts for this credential...';
    }

    if (cloudflareAccounts.length === 0) {
      return 'No Cloudflare accounts were found for this credential. Check the token permissions or choose another credential.';
    }

    if (cloudflareAccounts.length === 1) {
      return 'This credential has one available Cloudflare account and it will be used automatically.';
    }

    return 'Choose which Cloudflare account should receive the new zones.';
  }, [selectedAccountId, isLoadingAccounts, cloudflareAccounts]);

  return {
    accountsToUse,
    selectedAccount,
    cloudflareAccounts,
    selectedCloudflareAccount,
    selectedCloudflareAccountId,
    setSelectedCloudflareAccountId,
    isLoadingAccounts,
    hasAvailableCloudflareAccounts: cloudflareAccounts.length > 0,
    requiresExplicitSelection: cloudflareAccounts.length > 1,
    destinationAccountMessage,
  };
}
