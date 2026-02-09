'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatNginxError, extractNginxError } from '@/lib/nginx-error';

interface AddRedirectDialogProps {
    availableDomains: string[];
    initialDomain?: string;
    onAdd: (domain: string, urls: string[]) => Promise<void>;
}

export function AddRedirectDialog({ availableDomains, initialDomain, onAdd }: AddRedirectDialogProps) {
    const [open, setOpen] = useState(false);
    const [urls, setUrls] = useState('');
    const [selectedDomain, setSelectedDomain] = useState(initialDomain || availableDomains[0] || '');
    const [isLoading, setIsLoading] = useState(false);

    // Update selected domain when dialog opens with new initial value
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen) {
            setSelectedDomain(initialDomain || availableDomains[0] || '');
        }
    };

    const handleSubmit = async () => {
        if (!selectedDomain) {
            toast.error('Please select a domain');
            return;
        }

        // Parse URLs from textarea (one per line)
        const urlList = urls
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        if (urlList.length === 0) {
            toast.error('Please enter at least one URL');
            return;
        }

        // Validate URLs
        const invalidUrls = urlList.filter(url => {
            try {
                new URL(url);
                return false;
            } catch {
                return true;
            }
        });

        if (invalidUrls.length > 0) {
            toast.error('Invalid URLs detected', {
                description: `The following URLs are invalid:\n${invalidUrls.join('\n')}`,
            });
            return;
        }

        setIsLoading(true);
        try {
            await onAdd(selectedDomain, urlList);
            setUrls('');
            setOpen(false);
            toast.success(`Successfully added ${urlList.length} redirect${urlList.length !== 1 ? 's' : ''} to ${selectedDomain}`);
        } catch (error) {
            console.error('Failed to add redirects:', error);

            // Check for nginx configuration error
            const nginxErr = extractNginxError(error);
            if (nginxErr) {
                const formatted = formatNginxError(nginxErr);
                toast.error(formatted.title, {
                    description: formatted.description,
                    duration: Infinity,
                    closeButton: true,
                });
            } else {
                toast.error('Failed to add redirects', {
                    description: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Redirect
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Add Redirects</DialogTitle>
                    <DialogDescription>
                        Select a domain and enter destination URLs. A unique slug will be generated automatically for each URL.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="domain">Target Domain</Label>
                        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                            <SelectTrigger id="domain">
                                <SelectValue placeholder="Select domain" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableDomains.map((domain) => (
                                    <SelectItem key={domain} value={domain}>
                                        {domain}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Redirects will be added to this domain's nginx configuration
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="urls">Destination URLs</Label>
                        <Textarea
                            id="urls"
                            placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
                            value={urls}
                            onChange={(e) => setUrls(e.target.value)}
                            className="min-h-[200px] font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            Each URL will get a unique slug like <code className="bg-muted px-1 py-0.5 rounded">/abc123</code>
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !urls.trim() || !selectedDomain}
                    >
                        {isLoading ? 'Adding...' : `Add Redirect${urls.split('\n').filter(u => u.trim()).length > 1 ? 's' : ''}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
