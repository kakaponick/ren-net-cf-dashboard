'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { NameserversSection } from '@/components/nameservers-section';
import { toast } from 'sonner';
import type { DNSRecord } from '@/types/cloudflare';

export default function DNSRecordsPage() {
  const params = useParams();
  const zoneId = params.zoneId as string;
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const { accounts, isLoading: accountsLoading } = useAccountStore();
  const { 
    getDNSRecords,
    getZoneDetails,
    setDNSRecords,
    setZoneDetails,
    setLoading,
    isCacheValid,
    isLoading,
    clearZoneCache
  } = useCloudflareCache();
  
  const [records, setRecords] = useState<any[]>([]);
  const [zone, setZone] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: 'A' as DNSRecord['type'],
    name: '',
    content: '',
    ttl: 1,
    proxied: false,
    comment: '',
    priority: 10,
  });

  const account = accounts.find((acc: any) => acc.id === accountId);
  const { getDomainNameservers, setDomainNameservers } = useAccountStore();
  
  // Get nameservers from zone or store
  const nameservers = zone?.name_servers && Array.isArray(zone.name_servers) && zone.name_servers.length > 0
    ? zone.name_servers
    : (zone?.name ? getDomainNameservers(zone.name) : []);

  useEffect(() => {
    // Only proceed if accounts are loaded and not loading
    if (!accountsLoading && account && zoneId && accountId) {
      const cacheKey = `${zoneId}-${accountId}`;
      
      // Load zone details
      const cachedZone = getZoneDetails(zoneId, accountId);
      if (cachedZone && isCacheValid('zoneDetails', cacheKey)) {
        setZone(cachedZone);
        // Save nameservers to store if available
        if (cachedZone?.name_servers && Array.isArray(cachedZone.name_servers) && cachedZone.name_servers.length > 0 && cachedZone?.name) {
          setDomainNameservers(cachedZone.name, cachedZone.name_servers);
        }
      } else {
        loadZone();
      }
      
      // Load DNS records
      const cachedRecords = getDNSRecords(zoneId, accountId);
      if (cachedRecords.length > 0 && isCacheValid('dnsRecords', cacheKey)) {
        setRecords(cachedRecords);
      } else {
        loadRecords();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, zoneId, accountId, accountsLoading]);

  const loadZone = async () => {
    if (!account || !zoneId || !accountId) return;

    const cacheKey = `${zoneId}-${accountId}`;
    setLoading('zoneDetails', cacheKey, true);
    
    try {
      const api = new CloudflareAPI(account.apiToken);
      const zoneData = await api.getZone(zoneId);
      setZone(zoneData);
      setZoneDetails(zoneId, accountId, zoneData);
      
      // Save nameservers to store
      if (zoneData?.name_servers && Array.isArray(zoneData.name_servers) && zoneData.name_servers.length > 0 && zoneData?.name) {
        setDomainNameservers(zoneData.name, zoneData.name_servers);
      }
    } catch (error) {
      console.error('Error loading zone:', error);
      toast.error('Failed to load zone information');
    } finally {
      setLoading('zoneDetails', cacheKey, false);
    }
  };

  const loadRecords = async (forceRefresh = false) => {
    if (!account || !zoneId || !accountId) return;

    const cacheKey = `${zoneId}-${accountId}`;
    
    // Don't load if cache is valid and not forcing refresh
    if (!forceRefresh && isCacheValid('dnsRecords', cacheKey)) {
      const cachedRecords = getDNSRecords(zoneId, accountId);
      if (cachedRecords.length > 0) {
        setRecords(cachedRecords);
        return;
      }
    }

    setLoading('dnsRecords', cacheKey, true);
    try {
      const api = new CloudflareAPI(account.apiToken);
      const recordsData = await api.getDNSRecords(zoneId);
      setRecords(recordsData);
      setDNSRecords(zoneId, accountId, recordsData);
    } catch (error) {
      console.error('Error loading DNS records:', error);
      toast.error('Failed to load DNS records');
    } finally {
      setLoading('dnsRecords', cacheKey, false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account || !zoneId || !accountId) return;

    try {
      const api = new CloudflareAPI(account.apiToken);
      
      if (isEditing) {
        await api.updateDNSRecord(zoneId, isEditing, formData);
        toast.success('DNS record updated successfully');
      } else {
        await api.createDNSRecord(zoneId, formData);
        toast.success('DNS record created successfully');
      }
      
      setIsAddDialogOpen(false);
      setIsEditing(null);
      setFormData({
        type: 'A',
        name: '',
        content: '',
        ttl: 1,
        proxied: false,
        comment: '',
        priority: 10,
      });
      // Clear cache and reload
      clearZoneCache(zoneId, accountId);
      loadRecords(true);
    } catch (error) {
      toast.error(`Failed to save DNS record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!account || !zoneId || !accountId) return;
    
    if (window.confirm('Are you sure you want to delete this DNS record?')) {
      try {
        const api = new CloudflareAPI(account.apiToken);
        await api.deleteDNSRecord(zoneId, recordId);
        toast.success('DNS record deleted successfully');
        // Clear cache and reload
        clearZoneCache(zoneId, accountId);
        loadRecords(true);
      } catch (error) {
        toast.error('Failed to delete DNS record');
      }
    }
  };

  const handleEdit = (record: DNSRecord) => {
    setFormData({
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      proxied: record.proxied,
      comment: record.comment || '',
      priority: record.priority ?? 10,
    });
    setIsEditing(record.id);
    setIsAddDialogOpen(true);
  };

  const getRecordTypeVariant = (type: DNSRecord['type']) => {
    const variants: Record<DNSRecord['type'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
      A: 'default',
      AAAA: 'secondary',
      CNAME: 'outline',
      MX: 'secondary',
      TXT: 'outline',
      SRV: 'destructive',
      NS: 'secondary',
      PTR: 'outline',
      CAA: 'secondary',
      LOC: 'outline',
      SSHFP: 'secondary',
      TLSA: 'outline',
      URI: 'secondary',
    };
    return variants[type] || 'secondary';
  };

  // Show loading state while accounts are loading
  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-medium mb-2">Loading Accounts...</h3>
            <p className="text-muted-foreground">
              Please wait while we load your Cloudflare accounts
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="text-center py-8">
            <h3 className="text-lg font-medium mb-2">Account Not Found</h3>
            <p className="text-muted-foreground mb-4">
              Please go back to Cloudflare and select a valid account
            </p>
            <Button asChild>
              <Link href="/">Go to Cloudflare</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button asChild variant="outline" size="icon" className='aspect-square w-12'>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">DNS Records</h1>
            <p className="text-muted-foreground">
              {zone ? `Managing DNS records for ${zone.name} (${account.name || account.email})` : 'Loading...'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button onClick={() => loadRecords(true)} disabled={isLoading.dnsRecords[`${zoneId}-${accountId}`] || isLoading.zoneDetails[`${zoneId}-${accountId}`]} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading.dnsRecords[`${zoneId}-${accountId}`] || isLoading.zoneDetails[`${zoneId}-${accountId}`] ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {isEditing ? 'Edit DNS Record' : 'Add DNS Record'}
                </DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Update the DNS record details' : 'Create a new DNS record'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Record Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as DNSRecord['type'] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="AAAA">AAAA</SelectItem>
                      <SelectItem value="CNAME">CNAME</SelectItem>
                      <SelectItem value="MX">MX</SelectItem>
                      <SelectItem value="TXT">TXT</SelectItem>
                      <SelectItem value="SRV">SRV</SelectItem>
                      <SelectItem value="NS">NS</SelectItem>
                      <SelectItem value="PTR">PTR</SelectItem>
                      <SelectItem value="CAA">CAA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="subdomain or @"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Input
                    id="content"
                    placeholder="IP address or domain"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  />
                </div>

                {formData.type === 'MX' && (
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Input
                      id="priority"
                      type="number"
                      min="0"
                      max="65535"
                      placeholder="10"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: parseInt(e.target.value) || 10 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower numbers indicate higher priority (0-65535)
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="ttl">TTL</Label>
                  <Select value={formData.ttl.toString()} onValueChange={(value) => setFormData({ ...formData, ttl: parseInt(value) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Auto (1)</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="600">10 minutes</SelectItem>
                      <SelectItem value="1800">30 minutes</SelectItem>
                      <SelectItem value="3600">1 hour</SelectItem>
                      <SelectItem value="7200">2 hours</SelectItem>
                      <SelectItem value="18000">5 hours</SelectItem>
                      <SelectItem value="43200">12 hours</SelectItem>
                      <SelectItem value="86400">1 day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="proxied">Cloudflare Proxy</Label>
                    <div className="text-sm text-muted-foreground">
                      Route traffic through Cloudflare for DDoS protection and caching
                    </div>
                  </div>
                  <Switch
                    id="proxied"
                    checked={formData.proxied}
                    onCheckedChange={(checked) => setFormData({ ...formData, proxied: checked })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="comment">Comment (optional)</Label>
                  <Input
                    id="comment"
                    placeholder="Description of this record"
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsAddDialogOpen(false);
                    setIsEditing(null);
                    setFormData({
                      type: 'A',
                      name: '',
                      content: '',
                      ttl: 1,
                      proxied: false,
                      comment: '',
                      priority: 10,
                    });
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {isEditing ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {zone && nameservers && nameservers.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <NameserversSection nameservers={nameservers} />
          </CardContent>
        </Card>
      )}

      {isLoading.dnsRecords[`${zoneId}-${accountId}`] ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading DNS records...</p>
            </div>
          </CardContent>
        </Card>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-medium mb-2">No DNS records found</h3>
            <p className="text-muted-foreground mb-4">
              This zone doesn&apos;t have any DNS records yet
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Record
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>TTL</TableHead>
                <TableHead>Proxy</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Badge variant={getRecordTypeVariant(record.type)}>
                      {record.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{record.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{record.content}</TableCell>
                  <TableCell>{record.ttl === 1 ? 'Auto' : `${record.ttl}s`}</TableCell>
                  <TableCell>
                    <Badge variant={record.proxied ? 'default' : 'secondary'}>
                      {record.proxied ? 'Proxied' : 'DNS Only'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(record)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(record.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}