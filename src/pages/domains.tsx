import { useCallback, useEffect, useMemo, useState, memo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Globe, Search, Settings, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Copy, ExternalLink, Plus } from 'lucide-react';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import type { Zone, DNSRecord } from '@/types/cloudflare';
import { cn } from '@/lib/utils';
import { useSelection } from '@/hooks/use-selection';

type SortField = 'name' | 'status' | 'account' | 'created' | 'rootARecord' | 'proxied';
type SortDirection = 'asc' | 'desc';

interface ZoneWithDNS {
  zone: Zone;
  accountId: string;
  accountName: string;
  accountEmail: string;
  dnsRecords?: DNSRecord[];
  rootARecords?: DNSRecord[]; // Pre-filtered
}

const handleCopyIP = async (ip: string) => {
  try {
    await navigator.clipboard.writeText(ip);
    toast.success(`Copied ${ip} to clipboard`);
  } catch (error) {
    console.error('Failed to copy IP:', error);
    toast.error('Failed to copy IP address');
  }
};

type ARecordsCellProps = { rootARecords: DNSRecord[] };
const ARecordsCell = memo(function ARecordsCell({ rootARecords }: ARecordsCellProps) {
  if (!rootARecords || rootARecords.length === 0) {
    return <span className="text-sm text-muted-foreground">No root A record</span>;
  }

  return (
    <div className="space-y-1">
      {rootARecords.map((record, index) => (
        <div key={index} className="flex items-center space-x-2">
          <span className="text-sm font-mono text-blue-600 dark:text-blue-400">
            {record.content}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={() => handleCopyIP(record.content)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
});

type ProxiedCellProps = { rootARecords: DNSRecord[] };
const ProxiedCell = memo(function ProxiedCell({ rootARecords }: ProxiedCellProps) {
  if (!rootARecords || rootARecords.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {rootARecords.map((record, index) => (
        <Badge 
          key={index}
          variant="outline"
          className={cn(record.proxied ? 'shadow-green-500' : 'shadow-white text-white',"shadow shrink-0 text-sm" )}
          title={record.proxied ? 'Proxied' : 'DNS Only'}
        >
          {record.proxied ? '🟢' : '⚪'}
        </Badge>
      ))}
    </div>
  );
});

type DomainRowProps = {
  item: ZoneWithDNS;
  rowId: string;
  isSelected: boolean;
  onToggle: (rowId: string) => void;
  getStatusBadgeVariant: (status: Zone['status']) => 'default' | 'secondary' | 'outline' | 'destructive';
};

const DomainRow = memo(function DomainRow({ item, rowId, isSelected, onToggle, getStatusBadgeVariant }: DomainRowProps) {
  const handleToggle = useCallback(() => onToggle(rowId), [onToggle, rowId]);
  
  return (
    <TableRow>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={handleToggle} />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{item.zone.name}</span>
            <a
              href={`https://${item.zone.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={`Open ${item.zone.name} in new tab`}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <span className="text-xs text-muted-foreground">
            {item.zone.name_servers?.length || 0} name servers
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusBadgeVariant(item.zone.status)}>
          {item.zone.status}
        </Badge>
      </TableCell>
      <TableCell>
        <ProxiedCell rootARecords={item.rootARecords || []} />
      </TableCell>
      <TableCell>
        <ARecordsCell rootARecords={item.rootARecords || []} />
      </TableCell>
      <TableCell>
        <span className="text-sm">{item.accountEmail}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {new Date(item.zone.created_on).toLocaleDateString()}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end space-x-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/dns/${item.zone.id}?account=${item.accountId}`}>
              <Settings className="mr-1 h-3 w-3" />
              DNS
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export default function DomainsPage() {
  const { accounts, isLoading: accountsLoading } = useAccountStore();
  const { 
    zones, 
    isLoading,
    setZones, 
    setLoading, 
    isCacheValid,
    getDNSRecords
  } = useCloudflareCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // selection state handled by useSelection
  const navigate = useNavigate();

  const [dnsRecordsCache, setDnsRecordsCache] = useState<Record<string, DNSRecord[]>>({});
  
  // Add domain dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const hasLoadedZones = useRef(false);
  
  // Performance timing
  const mountTime = useRef(performance.now());
  const dataReadyTime = useRef(0);
  const [renderMetrics, setRenderMetrics] = useState({
    mountToData: 0,
    dataToRender: 0,
    totalRenderTime: 0,
  });
  
  useEffect(() => {
    // Only proceed if accounts are loaded and not loading
    if (!accountsLoading && accounts.length > 0) {
      // Only load if cache is invalid or empty
      if (!isCacheValid('zones') || zones.length === 0) {
        loadZones().then(() => {
          hasLoadedZones.current = true;
        });
      } else if (!hasLoadedZones.current) {
        // Only load DNS records once when component mounts with cached zones
        loadDNSRecordsForAllZones();
        hasLoadedZones.current = true;
      }
    }
  }, [accounts, accountsLoading]);

  // Helper to filter root A records once during data preparation
  const getRootARecordsFromDNS = useCallback((records: DNSRecord[], domainName: string): DNSRecord[] => {
    if (!records || records.length === 0) return [];
    return records.filter(
      (record) => record.type === 'A' && (record.name === domainName || record.name === '@' || record.name === '')
    );
  }, []);
  
  // Memoize enriched zones with pre-filtered root A records
  const enrichedZones = useMemo(() => {
    if (zones.length === 0) return [];
    
    const startTime = performance.now();
    const result = zones.map(item => {
      const account = accounts.find(acc => acc.id === item.accountId);
      const cacheKey = `${item.zone.id}-${item.accountId}`;
      const records = dnsRecordsCache[cacheKey] || getDNSRecords(item.zone.id, item.accountId) || [];
      const rootARecords = getRootARecordsFromDNS(records, item.zone.name);
      
      const enriched: ZoneWithDNS = {
        ...item,
        accountEmail: account?.email || item.accountName,
        dnsRecords: records,
        rootARecords
      };
      
      return enriched;
    });
    
    const enrichTime = performance.now() - startTime;
    console.log(`⚙️ enrichedZones calculation: ${enrichTime.toFixed(2)}ms for ${zones.length} zones`);
    
    return result;
  }, [zones, accounts, dnsRecordsCache, getDNSRecords, getRootARecordsFromDNS]);

  // Memoize filtering and sorting
  const filteredZones = useMemo(() => {
    const startTime = performance.now();
    let filtered = enrichedZones;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.accountEmail.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = a.zone.name.toLowerCase();
          bValue = b.zone.name.toLowerCase();
          break;
        case 'status':
          aValue = a.zone.status;
          bValue = b.zone.status;
          break;
        case 'account':
          aValue = a.accountEmail.toLowerCase();
          bValue = b.accountEmail.toLowerCase();
          break;
        case 'created':
          aValue = new Date(a.zone.created_on).getTime();
          bValue = new Date(b.zone.created_on).getTime();
          break;
        case 'rootARecord':
          aValue = a.rootARecords?.[0]?.content || '';
          bValue = b.rootARecords?.[0]?.content || '';
          break;
        case 'proxied':
          aValue = (a.rootARecords || []).some(r => r.proxied) ? 2 : (a.rootARecords?.length ? 1 : 0);
          bValue = (b.rootARecords || []).some(r => r.proxied) ? 2 : (b.rootARecords?.length ? 1 : 0);
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    const filterTime = performance.now() - startTime;
    console.log(`🔍 filter+sort: ${filterTime.toFixed(2)}ms (${sorted.length} results)`);
    
    return sorted;
  }, [enrichedZones, searchTerm, sortField, sortDirection]);

  // Memoized list of ids for selection
  const currentIds = useMemo(
    () => filteredZones.map((item) => `${item.accountId}-${item.zone.id}`),
    [filteredZones]
  );
  const { isSelected, toggleOne, toggleAll, clear, allSelected, selectedCount } = useSelection(currentIds);

  // Track when data is ready
  useEffect(() => {
    if (enrichedZones.length > 0 && dataReadyTime.current === 0) {
      dataReadyTime.current = performance.now();
      const mountToData = dataReadyTime.current - mountTime.current;
      console.log(`📊 Data ready in ${mountToData.toFixed(2)}ms`);
      setRenderMetrics(prev => ({ ...prev, mountToData }));
    }
  }, [enrichedZones]);
  
  // Track initial render complete
  useEffect(() => {
    if (filteredZones.length > 0 && !isLoading.zones) {
      requestAnimationFrame(() => {
        const renderComplete = performance.now();
        const totalTime = renderComplete - mountTime.current;
        const dataToRender = dataReadyTime.current > 0 ? renderComplete - dataReadyTime.current : 0;
        
        setRenderMetrics({
          mountToData: dataReadyTime.current - mountTime.current,
          dataToRender,
          totalRenderTime: totalTime,
        });
        
        console.log(`🎨 Render Metrics:
  - Mount to Data: ${(dataReadyTime.current - mountTime.current).toFixed(2)}ms
  - Data to Render: ${dataToRender.toFixed(2)}ms
  - Total Time: ${totalTime.toFixed(2)}ms
  - Zones: ${filteredZones.length}`);
      });
    }
  }, [filteredZones, isLoading.zones]);

  const loadDNSRecordsForAllZones = async () => {
    if (zones.length === 0 || accounts.length === 0) return;

    const recordsCache: Record<string, DNSRecord[]> = {};
    const fetchPromises: Promise<void>[] = [];
    
    // First, populate cache with already-cached records
    zones.forEach((item) => {
      const cacheKey = `${item.zone.id}-${item.accountId}`;
      const cachedRecords = getDNSRecords(item.zone.id, item.accountId);
      
      if (cachedRecords.length > 0 && isCacheValid('dnsRecords', cacheKey)) {
        recordsCache[cacheKey] = cachedRecords;
      } else {
        // Only fetch if not in cache or cache invalid
        const account = accounts.find(acc => acc.id === item.accountId);
        if (!account) return;
        
        const fetchPromise = (async () => {
          try {
            const api = new CloudflareAPI(account.apiToken);
            const records = await api.getDNSRecords(item.zone.id);
            recordsCache[cacheKey] = records;
            
            // Also update the global cache
            const { setDNSRecords } = useCloudflareCache.getState();
            setDNSRecords(item.zone.id, item.accountId, records);
          } catch (error) {
            console.error(`Error loading DNS records for ${item.zone.name}:`, error);
            recordsCache[cacheKey] = [];
          }
        })();
        
        fetchPromises.push(fetchPromise);
      }
    });

    // Only wait if there are actual fetches to do
    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises);
    }
    
    setDnsRecordsCache(recordsCache);
  };

  const loadZones = async (forceRefresh = false) => {
    if (accounts.length === 0) return;

    // Don't load if cache is valid and not forcing refresh
    if (!forceRefresh && isCacheValid('zones') && zones.length > 0) {
      return;
    }

    // Reset performance timer on refresh
    if (forceRefresh) {
      mountTime.current = performance.now();
      dataReadyTime.current = 0;
      console.log('🔄 Starting refresh timer...');
    }

    setLoading('zones', '', true);
    try {
      const allZones: any[] = [];
      
      // Load zones from all accounts in parallel
      const promises = accounts.map(async (account) => {
        try {
          const api = new CloudflareAPI(account.apiToken);
          const zonesData = await api.getZones();
          console.log(`Loaded ${zonesData.length} zones for account ${account.name}`);
          return zonesData.map((zone: any) => ({
            zone,
            accountId: account.id,
            accountName: account.name,
          }));
        } catch (error) {
          console.error(`Error loading zones for account ${account.name}:`, error);
          toast.error(`Failed to load zones for ${account.name}`);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach((accountZones: any[]) => {
        allZones.push(...accountZones);
      });

      setZones(allZones);
      toast.success(`Loaded ${allZones.length} domains from ${accounts.length} accounts`);
      
      // Load DNS records for newly loaded zones
      const recordsCache: Record<string, DNSRecord[]> = {};
      const dnsPromises = allZones.map(async (item: any) => {
        const account = accounts.find(acc => acc.id === item.accountId);
        if (!account) return;
        
        const cacheKey = `${item.zone.id}-${item.accountId}`;
        try {
          const api = new CloudflareAPI(account.apiToken);
          const records = await api.getDNSRecords(item.zone.id);
          recordsCache[cacheKey] = records;
          
          const { setDNSRecords } = useCloudflareCache.getState();
          setDNSRecords(item.zone.id, item.accountId, records);
        } catch (error) {
          console.error(`Error loading DNS records for ${item.zone.name}:`, error);
          recordsCache[cacheKey] = [];
        }
      });
      
      await Promise.all(dnsPromises);
      setDnsRecordsCache(recordsCache);
    } catch (error) {
      toast.error('Failed to load domains');
      console.error('Error loading zones:', error);
    } finally {
      setLoading('zones', '', false);
    }
  };

  const handleCreateDomain = async () => {
    if (!newDomainName.trim()) {
      toast.error('Please enter a domain name');
      return;
    }

    if (!selectedAccountId) {
      toast.error('Please select an account');
      return;
    }

    // Validate domain name format (basic validation)
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(newDomainName.trim())) {
      toast.error('Please enter a valid domain name (e.g., example.com)');
      return;
    }

    setIsCreating(true);
    try {
      const account = accounts.find(acc => acc.id === selectedAccountId);
      if (!account) {
        toast.error('Selected account not found');
        return;
      }

      const api = new CloudflareAPI(account.apiToken);
      // The API will automatically fetch the Cloudflare account ID for this token
      await api.createZone(newDomainName.trim());
      
      toast.success(`Domain "${newDomainName}" created successfully!`);
      
      // Reset form
      setNewDomainName('');
      setSelectedAccountId('');
      setIsAddDialogOpen(false);
      
      // Refresh zones
      await loadZones(true);
    } catch (error) {
      console.error('Error creating domain:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create domain';
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadgeVariant = useCallback((status: Zone['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'active':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'initializing':
        return 'outline';
      default:
        return 'secondary';
    }
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const handleSelectAll = useCallback(() => {
    toggleAll();
  }, [toggleAll]);

  // Single stable toggle handler that uses the rowId
  const handleRowToggle = useCallback((rowId: string) => {
    toggleOne(rowId);
  }, [toggleOne]);


  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };


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

  if (accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="text-center py-8">
            <h3 className="text-lg font-medium mb-2">No Accounts Added</h3>
            <p className="text-muted-foreground mb-4">
              Please add Cloudflare accounts to view domains
            </p>
            <Button onClick={() => navigate('/accounts')}>
              Go to Accounts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Domains</h1>
          <p className="text-muted-foreground">
            Manage your Cloudflare zones and domains from all accounts
            {isCacheValid('zones') && zones.length > 0 && (
              <span className="ml-2 text-green-600 text-sm">
                • Cached ({filteredZones.length} of {zones.length} domains)
              </span>
            )}
            {renderMetrics.totalRenderTime > 0 && (
              <span className="ml-2 text-blue-600 text-sm" title="Total render time">
                ⚡ {renderMetrics.totalRenderTime.toFixed(0)}ms
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Domain</DialogTitle>
                <DialogDescription>
                  Add a new domain to your Cloudflare account. Select which account to use.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="domain-name">Domain Name</Label>
                  <Input
                    id="domain-name"
                    placeholder="example.com"
                    value={newDomainName}
                    onChange={(e) => setNewDomainName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isCreating) {
                        handleCreateDomain();
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-select">Account</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger id="account-select">
                      <SelectValue placeholder="Select an account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setNewDomainName('');
                    setSelectedAccountId('');
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateDomain} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Domain
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search domains or accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button 
            onClick={() => loadZones(true)} 
            disabled={isLoading.zones}
            variant="outline"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading.zones ? 'animate-spin' : ''}`} />
            Refresh Cache
          </Button>
        </div>
      </div>

      {selectedCount > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-primary">
                  {selectedCount} domain{selectedCount > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={clear}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading.zones ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading domains from all accounts...</p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take a moment if you have many domains
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filteredZones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm ? 'No domains found' : 'No domains available'}
            </h3>
            <p className="text-muted-foreground text-center">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'No domains found in any of your accounts'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
                    onCheckedChange={() => handleSelectAll()}
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-2">
                    <span>Domain</span>
                    {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-2">
                    <span>Status</span>
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('proxied')}
                >
                  <div className="flex items-center space-x-2">
                    <span>Proxied</span>
                    {getSortIcon('proxied')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('rootARecord')}
                >
                  <div className="flex items-center space-x-2">
                    <span>A Record</span>
                    {getSortIcon('rootARecord')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('account')}
                >
                  <div className="flex items-center space-x-2">
                    <span>Account</span>
                    {getSortIcon('account')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('created')}
                >
                  <div className="flex items-center space-x-2">
                    <span>Created</span>
                    {getSortIcon('created')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredZones.map((item) => {
                const rowId = `${item.accountId}-${item.zone.id}`;
                return (
                  <DomainRow
                    key={rowId}
                    item={item}
                    rowId={rowId}
                    isSelected={isSelected(rowId)}
                    onToggle={handleRowToggle}
                    getStatusBadgeVariant={getStatusBadgeVariant}
                  />
                );
              })}
            </TableBody>
            </Table>
          </div>
        </Card>
      )}

    </div>
  );
}
