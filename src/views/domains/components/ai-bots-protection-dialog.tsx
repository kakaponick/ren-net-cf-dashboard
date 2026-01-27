import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useAccountStore } from '@/store/account-store';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface AIBotsProtectionDialogProps {
    selectedZones: ZoneWithDNS[];
    onComplete?: () => void;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AIBotsProtectionDialog({ selectedZones, onComplete, trigger, open: controlledOpen, onOpenChange: controlledOnOpenChange }: AIBotsProtectionDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

    const [mode, setMode] = useState<'disabled' | 'block'>('disabled');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedCount, setProcessedCount] = useState(0);
    const { accounts } = useAccountStore();

    const handleUpdate = async () => {
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
                    failCount++;
                    continue;
                }

                try {
                    const api = new CloudflareAPI(account.apiToken);
                    await api.setAIBotsProtection(zone.zone.id, mode);
                    successCount++;
                } catch (error) {
                    console.error(`Error updating ${zone.zone.name}:`, error);
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Updated ${successCount} domain${successCount > 1 ? 's' : ''} successfully`);
            }
            if (failCount > 0) {
                toast.error(`Failed to update ${failCount} domain${failCount > 1 ? 's' : ''}`);
            }

            setOpen(false);
            onComplete?.();
        } catch (error) {
            toast.error('Failed to complete update');
        } finally {
            setIsProcessing(false);
            setProcessedCount(0);
        }
    };

    const progressPercentage = selectedZones.length > 0
        ? (processedCount / selectedZones.length) * 100
        : 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>AI Bots Protection</DialogTitle>
                    <DialogDescription>
                        Configure access for verified AI crawlers (like GPTBot, ClaudeBot) for {selectedZones.length} domain{selectedZones.length > 1 ? 's' : ''}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {isProcessing && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Processing...</span>
                                <span className="font-medium">{processedCount} / {selectedZones.length}</span>
                            </div>
                            <Progress value={progressPercentage} className="h-2" />
                        </div>
                    )}

                    <RadioGroup value={mode} onValueChange={(val) => setMode(val as 'disabled' | 'block')} className="grid grid-cols-2 gap-4" disabled={isProcessing}>
                        <Label
                            htmlFor="mode-disabled"
                            className={cn(
                                "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all",
                                mode === 'disabled' && "border-primary bg-primary/5"
                            )}
                        >
                            <RadioGroupItem value="disabled" id="mode-disabled" className="sr-only" />
                            <ShieldCheck className={cn("mb-2 h-6 w-6", mode === 'disabled' ? "text-primary" : "text-muted-foreground")} />
                            <div className="text-center">
                                <div className="font-semibold text-sm">Allow AI Bots</div>
                                <div className="text-xs text-muted-foreground mt-1">Permit verified AI crawlers</div>
                            </div>
                        </Label>

                        <Label
                            htmlFor="mode-block"
                            className={cn(
                                "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all",
                                mode === 'block' && "border-primary bg-primary/5"
                            )}
                        >
                            <RadioGroupItem value="block" id="mode-block" className="sr-only" />
                            <ShieldAlert className={cn("mb-2 h-6 w-6", mode === 'block' ? "text-destructive" : "text-muted-foreground")} />
                            <div className="text-center">
                                <div className="font-semibold text-sm">Block AI Bots</div>
                                <div className="text-xs text-muted-foreground mt-1">Block all AI crawlers</div>
                            </div>
                        </Label>
                    </RadioGroup>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessing}>Cancel</Button>
                    <Button onClick={handleUpdate} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Apply'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
