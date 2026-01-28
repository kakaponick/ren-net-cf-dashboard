import type { CloudflareAccount, ProxyAccount, SSHAccount } from '@/types/cloudflare';

const STORAGE_KEY = 'cloudflare-accounts';

export const storage = {
  // Account management
  getAccounts(): CloudflareAccount[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const accounts = stored ? JSON.parse(stored) : [];

      // Migrate existing accounts to include timestamps and category if they don't have them
      const migratedAccounts = accounts.map((account: any) => {
        const migratedAccount = { ...account };

        if (!account.createdAt) {
          migratedAccount.createdAt = new Date();
        } else {
          migratedAccount.createdAt = new Date(account.createdAt);
        }

        if (!account.category) {
          migratedAccount.category = "cloudflare";
        }

        // Set default registrar name for existing registrar accounts if not set
        if (account.category === "registrar" && !account.registrarName) {
          migratedAccount.registrarName = "namecheap"; // Default to namecheap for existing registrar accounts
        }

        // Set default username for existing registrar accounts if not set
        if (account.category === "registrar" && !account.username && account.email) {
          migratedAccount.username = account.email.split('@')[0];
        }

        return migratedAccount;
      });

      // Save migrated accounts back if migration occurred
      if (migratedAccounts.length > 0) {
        this.saveAccounts(migratedAccounts);
      }

      return migratedAccounts;
    } catch (error) {
      console.error('Error reading accounts from storage:', error);
      return [];
    }
  },

  saveAccounts(accounts: CloudflareAccount[]): void {
    if (typeof window === 'undefined') {
      return;
    }
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

  // Proxy account management
  getProxyAccounts(): ProxyAccount[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = localStorage.getItem('proxy-accounts');
      const accounts = stored ? JSON.parse(stored) : [];

      // Migrate existing accounts to include timestamps
      const migratedAccounts = accounts.map((account: any) => {
        const migratedAccount = { ...account };

        if (!account.createdAt) {
          migratedAccount.createdAt = new Date();
        } else {
          migratedAccount.createdAt = new Date(account.createdAt);
        }

        return migratedAccount;
      });

      // Save migrated accounts back if migration occurred
      if (migratedAccounts.length > 0) {
        this.saveProxyAccounts(migratedAccounts);
      }

      return migratedAccounts;
    } catch (error) {
      console.error('Error reading proxy accounts from storage:', error);
      return [];
    }
  },

  saveProxyAccounts(accounts: ProxyAccount[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem('proxy-accounts', JSON.stringify(accounts));
    } catch (error) {
      console.error('Error saving proxy accounts to storage:', error);
    }
  },

  addProxyAccount(account: ProxyAccount): void {
    const accounts = this.getProxyAccounts();
    accounts.push(account);
    this.saveProxyAccounts(accounts);
  },

  updateProxyAccount(id: string, updates: Partial<ProxyAccount>): void {
    const accounts = this.getProxyAccounts();
    const index = accounts.findIndex(acc => acc.id === id);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      this.saveProxyAccounts(accounts);
    }
  },

  removeProxyAccount(id: string): void {
    const accounts = this.getProxyAccounts();
    const filtered = accounts.filter(acc => acc.id !== id);
    this.saveProxyAccounts(filtered);
  },

  getProxyAccount(id: string): ProxyAccount | undefined {
    const accounts = this.getProxyAccounts();
    return accounts.find(acc => acc.id === id);
  },

  // SSH account management
  getSSHAccounts(): SSHAccount[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = localStorage.getItem('ssh-accounts');
      const accounts = stored ? JSON.parse(stored) : [];

      // Migrate existing accounts to include timestamps
      const migratedAccounts = accounts.map((account: any) => {
        const migratedAccount = { ...account };

        if (!account.createdAt) {
          migratedAccount.createdAt = new Date();
        } else {
          migratedAccount.createdAt = new Date(account.createdAt);
        }

        return migratedAccount;
      });

      // Save migrated accounts back if migration occurred
      if (migratedAccounts.length > 0) {
        this.saveSSHAccounts(migratedAccounts);
      }

      return migratedAccounts;
    } catch (error) {
      console.error('Error reading SSH accounts from storage:', error);
      return [];
    }
  },

  saveSSHAccounts(accounts: SSHAccount[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem('ssh-accounts', JSON.stringify(accounts));
    } catch (error) {
      console.error('Error saving SSH accounts to storage:', error);
    }
  },

  addSSHAccount(account: SSHAccount): void {
    const accounts = this.getSSHAccounts();
    accounts.push(account);
    this.saveSSHAccounts(accounts);
  },

  updateSSHAccount(id: string, updates: Partial<SSHAccount>): void {
    const accounts = this.getSSHAccounts();
    const index = accounts.findIndex(acc => acc.id === id);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      this.saveSSHAccounts(accounts);
    }
  },

  removeSSHAccount(id: string): void {
    const accounts = this.getSSHAccounts();
    const filtered = accounts.filter(acc => acc.id !== id);
    this.saveSSHAccounts(filtered);
  },

  getSSHAccount(id: string): SSHAccount | undefined {
    const accounts = this.getSSHAccounts();
    return accounts.find(acc => acc.id === id);
  },
};
