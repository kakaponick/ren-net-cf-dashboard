import { useState, useCallback } from 'react';
import { RefreshCw, Server, Copy, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import type { UnifiedDomain } from '@/types/registrar';
import { copyToClipboard } from '@/lib/utils';

interface NameserversCellProps {
    domain: UnifiedDomain;
    nameservers: string[] | null;
    isUsingOurDNS: boolean | null;
    isLoading: boolean;
    onRefresh: (domain: string) => void;
    onEdit: (domain: UnifiedDomain) => void;
}

export function NameserversCell({
    domain,
    nameservers,
    isUsingOurDNS,
    isLoading,
    onRefresh,
    onEdit,
}: NameserversCellProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async (ns: string[]) => {
        await copyToClipboard(
            ns.join('\n'),
            'Nameservers copied',
            'Failed to copy nameservers'
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    const handleRefresh = useCallback(() => {
        onRefresh(domain.name);
    }, [domain.name, onRefresh]);

    const handleEdit = useCallback(() => {
        onEdit(domain);
    }, [domain, onEdit]);

    // Only show for Namecheap domains
    if (domain.registrar !== 'namecheap') {
        return <div className="text-center text-muted-foreground">—</div>;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2">
                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
        );
    }

    // Show default DNS badge
    if (isUsingOurDNS) {
        return (
            <div className="flex items-center justify-center gap-2">
                <Badge variant="secondary" className="text-xs">
                    Standard DNS
                </Badge>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleEdit}
                    title="Edit nameservers"
                >
                    <Pencil className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleRefresh}
                    title="Refresh nameservers"
                >
                    <RefreshCw className="h-3 w-3" />
                </Button>
            </div>
        );
    }

    // Show custom nameservers
    if (nameservers && nameservers.length > 0) {
        const displayText = nameservers.length <= 2
            ? nameservers.join(', ')
            : `${nameservers[0]}, ${nameservers[1]}...`;

        return (
            <div className="flex items-center justify-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-auto py-1 px-2 font-mono text-xs hover:bg-muted text-left">
                            <div className="flex flex-col items-start gap-0.5">
                                <span className="font-medium leading-tight">
                                    {nameservers[0]}
                                </span>
                                {nameservers.length > 1 && (
                                    <div className="flex items-center gap-1.5 leading-tight">
                                        <span className="font-medium leading-tight">
                                            {nameservers[1]}
                                        </span>
                                        {nameservers.length > 2 && (
                                            <span className="shrink-0 px-1 py-0.5 bg-muted-foreground/10 text-muted-foreground rounded text-[9px] font-semibold">
                                                +{nameservers.length - 2}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">Nameservers ({nameservers.length})</h4>
                                <div className="flex gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 gap-1"
                                        onClick={() => void handleCopy(nameservers)}
                                    >
                                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copied ? 'Copied' : 'Copy'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7"
                                        onClick={handleEdit}
                                        title="Edit"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7"
                                        onClick={handleRefresh}
                                        title="Refresh"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                {nameservers.map((ns, i) => (
                                    <div key={i} className="text-sm font-mono bg-muted/50 px-2 py-1 rounded">
                                        {i + 1}. {ns}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleEdit}
                    title="Edit nameservers"
                >
                    <Pencil className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleRefresh}
                    title="Refresh nameservers"
                >
                    <RefreshCw className="h-3 w-3" />
                </Button>
            </div>
        );
    }

    // Not loaded yet
    return (
        <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">—</span>
            <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleEdit}
                title="Set nameservers"
            >
                <Pencil className="h-3 w-3" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleRefresh}
                title="Load nameservers"
            >
                <RefreshCw className="h-3 w-3" />
            </Button>
        </div>
    );
}
