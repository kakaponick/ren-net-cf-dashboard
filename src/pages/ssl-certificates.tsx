import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';

export default function SSLCertificatesPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('account');
  const { accounts, isLoading: accountsLoading } = useAccountStore();
  const { 
    getSSLData,
    getZoneDetails,
    setSSLData,
    setZoneDetails,
    setLoading,
    isCacheValid,
    isLoading
  } = useCloudflareCache();
  
  const [certificates, setCertificates] = useState<any[]>([]);
  const [sslSetting, setSslSetting] = useState<any | null>(null);
  const [zone, setZone] = useState<any | null>(null);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState(false);

  const account = accounts.find((acc: any) => acc.id === accountId);

  useEffect(() => {
    // Only proceed if accounts are loaded and not loading
    if (!accountsLoading && account && zoneId && accountId) {
      const cacheKey = `${zoneId}-${accountId}`;
      
      // Load zone details
      const cachedZone = getZoneDetails(zoneId, accountId);
      if (cachedZone && isCacheValid('zoneDetails', cacheKey)) {
        setZone(cachedZone);
      }
      
      // Load SSL data
      const cachedSSLData = getSSLData(zoneId, accountId);
      if (cachedSSLData && isCacheValid('sslData', cacheKey)) {
        setCertificates(cachedSSLData.certificates);
        setSslSetting(cachedSSLData.sslSetting);
      }
      
      // Load data if not cached
      if (!cachedZone || !cachedSSLData || !isCacheValid('sslData', cacheKey)) {
        loadData();
      }
    }
  }, [account, zoneId, accountId, accountsLoading]);

  const loadData = async (forceRefresh = false) => {
    if (!account || !zoneId || !accountId) return;

    const cacheKey = `${zoneId}-${accountId}`;
    
    // Don't load if cache is valid and not forcing refresh
    if (!forceRefresh && isCacheValid('sslData', cacheKey) && isCacheValid('zoneDetails', cacheKey)) {
      const cachedSSLData = getSSLData(zoneId, accountId);
      const cachedZone = getZoneDetails(zoneId, accountId);
      if (cachedSSLData && cachedZone) {
        setCertificates(cachedSSLData.certificates);
        setSslSetting(cachedSSLData.sslSetting);
        setZone(cachedZone);
        return;
      }
    }

    setLoading('sslData', cacheKey, true);
    try {
      const api = new CloudflareAPI(account.apiToken);
      
      const [certificatesData, sslSettingData, zoneData] = await Promise.all([
        api.getSSLCertificates(zoneId),
        api.getSSLSetting(zoneId),
        api.getZone(zoneId)
      ]);
      
      setCertificates(certificatesData);
      setSslSetting(sslSettingData);
      setZone(zoneData);
      
      // Debug: Log the actual certificate data structure
      console.log('SSL Certificate data:', certificatesData);
      
      // Cache the data
      setSSLData(zoneId, accountId, certificatesData, sslSettingData);
      setZoneDetails(zoneId, accountId, zoneData);
    } catch (error) {
      console.error('Error loading SSL data:', error);
      toast.error('Failed to load SSL data');
    } finally {
      setLoading('sslData', cacheKey, false);
    }
  };

  const handleSSLSettingUpdate = async (value: string) => {
    if (!account || !zoneId || !accountId) return;

    setIsUpdatingSetting(true);
    try {
      const api = new CloudflareAPI(account.apiToken);
      const updatedSetting = await api.updateSSLSetting(zoneId, value);
      setSslSetting(updatedSetting);
      
      // Update cache
      const cachedSSLData = getSSLData(zoneId, accountId);
      if (cachedSSLData) {
        setSSLData(zoneId, accountId, cachedSSLData.certificates, updatedSetting);
      }
      
      toast.success('SSL setting updated successfully');
    } catch (error) {
      toast.error('Failed to update SSL setting');
    } finally {
      setIsUpdatingSetting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending_validation':
      case 'pending_issuance':
      case 'pending_deployment':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed':
      case 'validation_timed_out':
      case 'issuance_timed_out':
      case 'deployment_timed_out':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'pending_validation':
      case 'pending_issuance':
      case 'pending_deployment':
        return 'secondary';
      case 'failed':
      case 'validation_timed_out':
      case 'issuance_timed_out':
      case 'deployment_timed_out':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getSSLModeDescription = (mode: string) => {
    const descriptions: Record<string, string> = {
      off: 'No encryption between visitor and Cloudflare',
      flexible: 'Encrypted between visitor and Cloudflare, not between Cloudflare and origin',
      full: 'Encrypted end-to-end, but Cloudflare doesn\'t validate the origin certificate',
      strict: 'Encrypted end-to-end with valid origin certificate'
    };
    return descriptions[mode] || 'Unknown SSL mode';
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
              Please go back to domains and select a valid account
            </p>
            <Button asChild>
              <Link to="/domains">Go to Domains</Link>
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
          <Button asChild variant="outline" size="sm">
            <Link to="/domains">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Domains
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">SSL Certificates</h1>
            <p className="text-muted-foreground">
              {zone ? `Managing SSL certificates for ${zone.name} (${account.name})` : 'Loading...'}
            </p>
          </div>
        </div>
        
        <Button onClick={() => loadData(true)} disabled={isLoading.sslData[`${zoneId}-${accountId}`]} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading.sslData[`${zoneId}-${accountId}`] ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* SSL Mode Setting */}
      {sslSetting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>SSL/TLS Encryption Mode</span>
            </CardTitle>
            <CardDescription>
              Control how Cloudflare handles SSL/TLS encryption
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Select
                value={sslSetting.value}
                onValueChange={handleSSLSettingUpdate}
                disabled={isUpdatingSetting || !sslSetting.editable}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="strict">Full (Strict)</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant={sslSetting.editable ? 'default' : 'secondary'}>
                {sslSetting.editable ? 'Editable' : 'Read Only'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {getSSLModeDescription(sslSetting.value)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Certificates */}
      {isLoading.sslData[`${zoneId}-${accountId}`] ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading SSL certificates...</p>
            </div>
          </CardContent>
        </Card>
      ) : certificates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No SSL certificates found</h3>
            <p className="text-muted-foreground text-center">
              This zone doesn't have any SSL certificates yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <Card key={cert.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    {getStatusIcon(cert.status)}
                    <span>{cert.type}</span>
                  </CardTitle>
                  <Badge variant={getStatusBadgeVariant(cert.status)}>
                    {cert.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <CardDescription>
                  {cert.hosts?.join(', ') || cert.hostnames?.join(', ') || cert.domains?.join(', ') || 'No hosts'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Issuer:</span>
                    <span className="font-medium">
                      {cert.issuer || cert.certificate_authority || cert.ca || 'Cloudflare'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valid for:</span>
                    <span className="font-medium">
                      {cert.validity_days || cert.days_until_expiry || '90'} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">
                      {cert.created_on ? new Date(cert.created_on).toLocaleDateString() : 
                       cert.issued_on ? new Date(cert.issued_on).toLocaleDateString() : 
                       'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span className="font-medium">
                      {cert.expires_on ? new Date(cert.expires_on).toLocaleDateString() : 
                       cert.valid_until ? new Date(cert.valid_until).toLocaleDateString() :
                       cert.created_on ? new Date(new Date(cert.created_on).getTime() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString() :
                       'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">{cert.type || cert.certificate_type || 'Universal'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium">{cert.status || 'Active'}</span>
                  </div>
                </div>
                
                {cert.validation_records && cert.validation_records.length > 0 && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Validation Records:</p>
                    <div className="space-y-1">
                      {cert.validation_records.map((record: any, index: number) => (
                        <div key={index} className="text-xs bg-muted p-2 rounded">
                          {record.cname && (
                            <div>CNAME: {record.cname} → {record.cname_target}</div>
                          )}
                          {record.txt_name && (
                            <div>TXT: {record.txt_name} = {record.txt_value}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {cert.validation_errors && cert.validation_errors.length > 0 && (
                  <div className="text-sm">
                    <p className="text-red-600 mb-1">Validation Errors:</p>
                    <div className="space-y-1">
                      {cert.validation_errors.map((error: any, index: number) => (
                        <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {error.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Debug section - remove in production */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Debug: Raw Certificate Data</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(cert, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}