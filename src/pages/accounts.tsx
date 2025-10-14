import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit, Upload } from 'lucide-react';
import { useAccountStore } from '@/store/account-store';
import { toast } from 'sonner';
import type { CloudflareAccount } from '@/types/cloudflare';

export default function AccountsPage() {
  const { accounts, loadAccounts, addAccount, updateAccount, removeAccount } = useAccountStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CloudflareAccount | null>(null);
  const [importData, setImportData] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    apiToken: '',
  });

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.apiToken) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const newAccount: CloudflareAccount = {
        id: crypto.randomUUID(),
        name: formData.name,
        email: formData.email,
        apiToken: formData.apiToken,
      };

      addAccount(newAccount);
      toast.success('Account added successfully');
      setIsAddDialogOpen(false);
      setFormData({ name: '', email: '', apiToken: '' });
    } catch (error) {
      toast.error('Failed to add account');
    }
  };

  const handleRemoveAccount = (id: string) => {
    if (window.confirm('Are you sure you want to remove this account?')) {
      removeAccount(id);
      toast.success('Account removed');
    }
  };

  const handleEditAccount = (account: CloudflareAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      email: account.email,
      apiToken: account.apiToken,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.apiToken) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!editingAccount) return;

    try {
      updateAccount(editingAccount.id, {
        name: formData.name,
        email: formData.email,
        apiToken: formData.apiToken,
      });
      toast.success('Account updated successfully');
      setIsEditDialogOpen(false);
      setEditingAccount(null);
      setFormData({ name: '', email: '', apiToken: '' });
    } catch (error) {
      toast.error('Failed to update account');
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!importData.trim()) {
      toast.error('Please enter accounts to import');
      return;
    }

    try {
      const lines = importData.trim().split('\n');
      let successCount = 0;
      let errorCount = 0;

      lines.forEach((line, index) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const apiToken = parts[1];
          const email = parts[0];
          
          const newAccount: CloudflareAccount = {
            id: crypto.randomUUID(),
            name: `CF ${accounts.length + index + 1}`,
            email: email,
            apiToken: apiToken,
          };

          addAccount(newAccount);
          successCount++;
        } else {
          errorCount++;
        }
      });

      if (successCount > 0) {
        toast.success(`Imported ${successCount} account(s) successfully`);
      }
      if (errorCount > 0) {
        toast.warning(`Skipped ${errorCount} invalid line(s)`);
      }

      setIsImportDialogOpen(false);
      setImportData('');
    } catch (error) {
      toast.error('Failed to import accounts');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cloudflare Accounts</h1>
          <p className="text-muted-foreground">
            Manage your Cloudflare accounts and API tokens
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Import Accounts</DialogTitle>
                <DialogDescription>
                  Enter API tokens and emails, one per line (format: apikey email)
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBulkImport} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-data">Accounts Data</Label>
                  <Textarea
                    id="import-data"
                    placeholder="apikey1 email1@example.com&#10;apikey2 email2@example.com&#10;apikey3 email3@example.com"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    className="min-h-[200px] font-mono text-xs"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Import</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Cloudflare Account</DialogTitle>
              <DialogDescription>
                Enter your Cloudflare account details and API token
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  placeholder="My Cloudflare Account"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiToken">API Token</Label>
                <Input
                  id="apiToken"
                  type="password"
                  placeholder="Your Cloudflare API token"
                  value={formData.apiToken}
                  onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Account</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cloudflare Account</DialogTitle>
            <DialogDescription>
              Update your Cloudflare account details and API token
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                placeholder="My Cloudflare Account"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-apiToken">API Token</Label>
              <Input
                id="edit-apiToken"
                type="password"
                placeholder="Your Cloudflare API token"
                value={formData.apiToken}
                onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Account</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-medium">No accounts added yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first Cloudflare account to get started
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{account.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditAccount(account)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{account.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  API Token: {account.apiToken.substring(0, 8)}...
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
