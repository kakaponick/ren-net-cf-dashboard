import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import { Progress } from '@/components/ui/progress';
import { SelectedDomainsList } from './selected-domains-list';

const SSL_TLS_MODES = [
  {
    value: 'off',
    label: 'Off (not secure)',
    description: 'No encryption applied',
  },
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'HTTPS to visitors, HTTP to origin',
  },
  {
    value: 'full',
    label: 'Full',
    description: 'End-to-end encryption',
  },
  {
    value: 'strict',
    label: 'Full (Strict)',
    description: 'Enforce valid origin certificate',
  },
] as const;

type SSLMode = (typeof SSL_TLS_MODES)[number]['value'];

interface BulkEditSSLDialogProps {
  selectedZones: ZoneWithDNS[];
  onComplete: () => void;
}

export function BulkEditSSLDialog({ selectedZones, onComplete }: BulkEditSSLDialogProps) {
  const [open, setOpen] = useState(false);
  const [sslMode, setSSLMode] = useState<SSLMode>('strict');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const { accounts } = useAccountStore();

  const currentModeSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedZones.forEach((zone) => {
      const mode = zone.sslMode || 'unknown';
      counts[mode] = (counts[mode] || 0) + 1;
    });
    return counts;
  }, [selectedZones]);

  const handleBulkUpdate = async () => {
    setIsProcessing(true);
    setProcessedCount(0);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < selectedZones.length; i++) {
        const zone = selectedZones[i];
        setProcessedCount(i + 1);
        const account = accounts.find(acc => acc.id === zone.accountId);
        if (!account) {
          console.error(`Account not found for zone ${zone.zone.name}`);
          failCount++;
          continue;
        }

        try {
          const api = new CloudflareAPI(account.apiToken);
          await api.setSSLMode(zone.zone.id, sslMode);

          // Update the SSL cache for instant UI feedback
          const { setSSLData, getSSLData } = useCloudflareCache.getState();
          const existingData = getSSLData(zone.zone.id, zone.accountId);
          setSSLData(zone.zone.id, zone.accountId, existingData?.certificates || [], {
            ...existingData?.sslSetting,
            value: sslMode,
          });

          successCount++;
        } catch (error) {
          console.error(`Error updating SSL for ${zone.zone.name}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Updated SSL/TLS mode for ${successCount} domain${successCount > 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to update ${failCount} domain${failCount > 1 ? 's' : ''}`);
      }

      setOpen(false);
      resetForm();
      onComplete();
    } catch (error) {
      toast.error('Failed to complete bulk SSL update');
      console.error('Bulk SSL update error:', error);
    } finally {
      setIsProcessing(false);
      setProcessedCount(0);
    }
  };

  const resetForm = () => {
    setSSLMode('strict');
    setProcessedCount(0);
  };

  const progressPercentage = selectedZones.length > 0
    ? (processedCount / selectedZones.length) * 100
    : 0;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Lock className="h-3.5 w-3.5" />
          SSL/TLS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 w-[95vw] sm:w-full">
        <DialogHeader className="px-4 sm:px-6 pt-6 pb-4 flex-shrink-0 border-b">
          <DialogTitle>
            Bulk Edit SSL/TLS Mode
          </DialogTitle>
          <DialogDescription>
            Update SSL/TLS encryption mode for {selectedZones.length} selected domain{selectedZones.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 min-h-0">
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processing domains...</span>
                <span className="font-medium">
                  {processedCount} / {selectedZones.length}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                SSL/TLS Encryption Mode
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {SSL_TLS_MODES.map((mode) => {
                  const isActive = sslMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSSLMode(mode.value)}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors cursor-pointer',
                        'hover:bg-accent/50',
                        isActive && 'border-primary bg-primary/10',
                        !isActive && 'border-border',
                        isProcessing && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span className={cn('text-sm font-medium', isActive && 'text-primary')}>
                        {mode.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {mode.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {Object.keys(currentModeSummary).length > 0 && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Current SSL modes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(currentModeSummary).map(([mode, count]) => {
                    const modeConfig = SSL_TLS_MODES.find(m => m.value === mode);
                    const displayLabel = modeConfig?.label || mode;
                    return (
                      <span
                        key={mode}
                        className="text-xs font-mono bg-background/80 px-2 py-1 rounded border border-border/50"
                      >
                        {displayLabel}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <SelectedDomainsList
            selectedZones={selectedZones}
            icon={Globe}
            showAccount={true}
          />
        </div>

        <DialogFooter className="px-4 sm:px-6 py-4 border-t flex-shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleBulkUpdate}
            disabled={isProcessing}
            className="w-full sm:w-auto gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update SSL/TLS'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
