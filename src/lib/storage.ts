import type { CloudflareAccount } from '@/types/cloudflare';

const STORAGE_KEY = 'cloudflare-accounts';

export const storage = {
  // Account management
  getAccounts(): CloudflareAccount[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading accounts from storage:', error);
      return [];
    }
  },

  saveAccounts(accounts: CloudflareAccount[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch (error) {
      console.error('Error saving accounts to storage:', error);
    }
  },

  addAccount(account: CloudflareAccount): void {
    const accounts = this.getAccounts();
    accounts.push(account);
    this.saveAccounts(accounts);
  },

  updateAccount(id: string, updates: Partial<CloudflareAccount>): void {
    const accounts = this.getAccounts();
    const index = accounts.findIndex(acc => acc.id === id);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      this.saveAccounts(accounts);
    }
  },

  removeAccount(id: string): void {
    const accounts = this.getAccounts();
    const filtered = accounts.filter(acc => acc.id !== id);
    this.saveAccounts(filtered);
  },

  getAccount(id: string): CloudflareAccount | undefined {
    const accounts = this.getAccounts();
    return accounts.find(acc => acc.id === id);
  },
};
