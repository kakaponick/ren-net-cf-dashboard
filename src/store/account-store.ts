import { create } from 'zustand';
import { storage } from '@/lib/storage';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import type { CloudflareAccount } from '@/types/cloudflare';

interface AccountStore {
  accounts: CloudflareAccount[];
  isLoading: boolean;
  error: string | null;
  domainNameservers: Record<string, string[]>; // domain -> nameservers mapping

  // Actions
  loadAccounts: () => void;
  addAccount: (account: CloudflareAccount) => void;
  updateAccount: (id: string, updates: Partial<CloudflareAccount>) => void;
  removeAccount: (id: string) => void;
  fetchAndCacheCloudflareAccounts: (accountId: string) => Promise<void>;
  setDomainNameservers: (domain: string, nameservers: string[]) => void;
  getDomainNameservers: (domain: string) => string[] | undefined;
  clearError: () => void;
}

const NAMESERVERS_STORAGE_KEY = 'cloudflare-domain-nameservers';

const loadNameservers = (): Record<string, string[]> => {
  try {
    const stored = localStorage.getItem(NAMESERVERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading nameservers from storage:', error);
    return {};
  }
};

const saveNameservers = (nameservers: Record<string, string[]>) => {
  try {
    localStorage.setItem(NAMESERVERS_STORAGE_KEY, JSON.stringify(nameservers));
  } catch (error) {
    console.error('Error saving nameservers to storage:', error);
  }
};

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,
  domainNameservers: loadNameservers(),

  loadAccounts: () => {
    try {
      const accounts = storage.getAccounts();
      set({ accounts, isLoading: false, error: null });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load accounts',
        isLoading: false 
      });
    }
  },

  addAccount: (account) => {
    try {
      storage.addAccount(account);
      const accounts = storage.getAccounts();
      set({ accounts, error: null });
      
      // Automatically fetch Cloudflare accounts for the new account
      get().fetchAndCacheCloudflareAccounts(account.id);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add account'
      });
    }
  },

  updateAccount: (id, updates) => {
    try {
      storage.updateAccount(id, updates);
      const accounts = storage.getAccounts();
      set({ accounts, error: null });
      
      // If API token changed, re-fetch Cloudflare accounts
      if (updates.apiToken) {
        get().fetchAndCacheCloudflareAccounts(id);
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update account'
      });
    }
  },

  removeAccount: (id) => {
    try {
      storage.removeAccount(id);
      const accounts = storage.getAccounts();
      set({ accounts, error: null });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to remove account'
      });
    }
  },

  fetchAndCacheCloudflareAccounts: async (accountId: string) => {
    try {
      const accounts = storage.getAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        console.error('Account not found:', accountId);
        return;
      }

      if (!account.apiToken) {
        console.error('API token missing for account:', accountId);
        return;
      }

      console.log('Fetching Cloudflare accounts for account:', accountId);
      const api = new CloudflareAPI(account.apiToken);
      let cfAccounts: any[] = [];
      
      // Try to fetch accounts directly first
      try {
        cfAccounts = await api.getAccounts();
        console.log('Cloudflare API /accounts response:', cfAccounts);
        console.log('Number of accounts:', cfAccounts?.length || 0);
      } catch (error) {
        console.warn('Failed to fetch accounts endpoint, trying zones as fallback:', error);
      }

      // If accounts endpoint returned empty or failed, try to get account IDs from zones
      if (!Array.isArray(cfAccounts) || cfAccounts.length === 0) {
        console.log('Attempting to extract account IDs from zones...');
        try {
          const zones = await api.getZones();
          console.log('Fetched zones:', zones.length);
          
          // Extract unique account IDs from zones
          const accountMap = new Map<string, string>();
          zones.forEach((zone: any) => {
            if (zone.account && zone.account.id) {
              accountMap.set(zone.account.id, zone.account.name || zone.account.id);
            }
          });
          
          if (accountMap.size > 0) {
            cfAccounts = Array.from(accountMap.entries()).map(([id, name]) => ({
              id,
              name: name || id || 'Unnamed Account'
            }));
            console.log('Extracted account IDs from zones:', cfAccounts);
          } else {
            console.warn('No account IDs found in zones either');
          }
        } catch (zoneError) {
          console.error('Failed to fetch zones as fallback:', zoneError);
        }
      }

      if (!Array.isArray(cfAccounts)) {
        console.error('Invalid response format - expected array, got:', typeof cfAccounts, cfAccounts);
        return;
      }

      if (cfAccounts.length === 0) {
        console.warn('No Cloudflare accounts found for this API token (tried /accounts and /zones)');
        // Still save empty array to prevent re-fetching
        storage.updateAccount(accountId, { cloudflareAccounts: [] });
        set({ accounts: storage.getAccounts() });
        return;
      }

      const simplifiedAccounts = cfAccounts.map((acc: any) => {
        if (!acc.id) {
          console.warn('Account missing id:', acc);
        }
        return {
          id: acc.id,
          name: acc.name || acc.id || 'Unnamed Account'
        };
      }).filter((acc: any) => acc.id); // Filter out any accounts without IDs

      console.log('Simplified accounts to save:', simplifiedAccounts);
      storage.updateAccount(accountId, { cloudflareAccounts: simplifiedAccounts });
      const updatedAccounts = storage.getAccounts();
      console.log('Updated account in storage:', updatedAccounts.find(acc => acc.id === accountId));
      set({ accounts: updatedAccounts });
    } catch (error) {
      console.error('Failed to fetch Cloudflare accounts:', error);
      // Don't set global error here to avoid disrupting UI for background fetch
    }
  },

  setDomainNameservers: (domain, nameservers) => {
    const current = get().domainNameservers;
    const updated = { ...current, [domain]: nameservers };
    saveNameservers(updated);
    set({ domainNameservers: updated });
  },

  getDomainNameservers: (domain) => {
    return get().domainNameservers[domain];
  },

  clearError: () => {
    set({ error: null });
  },
}));
