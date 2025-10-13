import { create } from 'zustand';
import { storage } from '@/lib/storage';
import type { CloudflareAccount } from '@/types/cloudflare';

interface AccountStore {
  accounts: CloudflareAccount[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadAccounts: () => void;
  addAccount: (account: CloudflareAccount) => void;
  updateAccount: (id: string, updates: Partial<CloudflareAccount>) => void;
  removeAccount: (id: string) => void;
  clearError: () => void;
}

export const useAccountStore = create<AccountStore>((set) => ({
  accounts: [],
  isLoading: false,
  error: null,

  loadAccounts: () => {
    set({ isLoading: true, error: null });
    try {
      const accounts = storage.getAccounts();
      set({ accounts, isLoading: false });
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

  clearError: () => {
    set({ error: null });
  },
}));
