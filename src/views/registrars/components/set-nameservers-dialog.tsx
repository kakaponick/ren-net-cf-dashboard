import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { UnifiedDomain } from '@/types/registrar';

interface SetNameserversDialogProps {
    selectedDomains: UnifiedDomain[];
    onSetNameservers: (domains: string[], nameservers: string[]) => Promise<boolean>;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    currentNameservers?: string[] | null;
    isLoadingNameservers?: boolean;
}

export function SetNameserversDialog({
    selectedDomains,
    onSetNameservers,
    open = false,
    onOpenChange,
    currentNameservers,
    isLoadingNameservers,
}: SetNameserversDialogProps) {
    const [nameserversInput, setNameserversInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter only Namecheap domains
    const namecheapDomains = selectedDomains.filter((d) => d.registrar === 'namecheap');
    const isBulk = namecheapDomains.length > 1;

    // Pre-fill with current nameservers when dialog opens
    useEffect(() => {
        if (open && currentNameservers && currentNameservers.length > 0) {
            setNameserversInput(currentNameservers.join('\n'));
        }
    }, [open, currentNameservers]);

    // Parse nameservers from input
    const parsedNameservers = nameserversInput
        .split(/[\n,]+/)
        .map((ns) => ns.trim())
        .filter((ns) => ns.length > 0);

    // Validation
    const getValidationError = () => {
        if (namecheapDomains.length === 0) {
            return 'No Namecheap domains selected';
        }

        if (parsedNameservers.length === 0) {
            return 'At least one nameserver is required';
        }

        if (parsedNameservers.length < 2) {
            return 'At least two nameservers are recommended';
        }

        // Basic validation for domain format
        const invalidNs = parsedNameservers.find(
            (ns) => !/^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/.test(ns)
        );

        if (invalidNs) {
            return `Invalid nameserver format: ${invalidNs}`;
        }

        return null;
    };

    const validationError = getValidationError();

    const handleSubmit = async () => {
        if (validationError) return;

        setIsSubmitting(true);
        try {
            const domainNames = namecheapDomains.map((d) => d.name);
            const success = await onSetNameservers(domainNames, parsedNameservers);

            if (success) {
                onOpenChange?.(false);
                setNameserversInput('');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && !isSubmitting) {
            setNameserversInput('');
        }
        onOpenChange?.(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Set Nameservers</DialogTitle>
                    <DialogDescription>
                        {isBulk
                            ? `Update nameservers for ${namecheapDomains.length} selected domains`
                            : `Update nameservers for ${namecheapDomains[0]?.name || 'domain'}`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Loading indicator */}
                    {isLoadingNameservers && (
                        <Alert>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertDescription>Updating nameservers...</AlertDescription>
                        </Alert>
                    )}

                    {/* Bulk warning */}
                    {isBulk && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                This will overwrite nameservers for all {namecheapDomains.length} selected domains.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Nameservers input */}
                    <div className="space-y-2">
                        <Label htmlFor="nameservers">
                            Nameservers
                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                                (one per line)
                            </span>
                        </Label>
                        <Textarea
                            id="nameservers"
                            placeholder="ns1.example.com&#10;ns2.example.com"
                            value={nameserversInput}
                            onChange={(e) => setNameserversInput(e.target.value)}
                            rows={6}
                            className="font-mono text-sm"
                            disabled={isLoadingNameservers}
                        />
                    </div>

                    {/* Preview */}
                    {parsedNameservers.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                                {parsedNameservers.length} nameserver{parsedNameservers.length !== 1 ? 's' : ''}
                            </Label>
                            <div className="rounded-md border bg-muted/30 p-3 text-sm font-mono space-y-1">
                                {parsedNameservers.map((ns, i) => (
                                    <div key={i} className="text-muted-foreground">
                                        {i + 1}. {ns}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Validation error */}
                    {validationError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{validationError}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        disabled={!!validationError || isSubmitting || isLoadingNameservers}
                    >
                        {isSubmitting ? 'Updating...' : 'Update Nameservers'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
