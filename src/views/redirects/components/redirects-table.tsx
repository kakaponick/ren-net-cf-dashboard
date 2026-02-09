'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { NPMRedirectListResponse } from '@/types/npm';
import { Trash2, RefreshCw } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface RedirectsTableProps {
    redirects: NPMRedirectListResponse[];
    onDelete: (id: number) => void;
    onRefresh: () => void;
}

export function RedirectsTable({ redirects, onDelete, onRefresh }: RedirectsTableProps) {
    const formatDomains = (domains: string[]) => {
        if (domains.length === 0) return '-';
        if (domains.length === 1) return domains[0];
        return (
            <div className="flex flex-wrap gap-1">
                {domains.map((domain, index) => (
                    <Badge key={index} variant="outline">
                        {domain}
                    </Badge>
                ))}
            </div>
        );
    };

    const formatForwardUrl = (redirect: NPMRedirectListResponse) => {
        const port = redirect.forward_port ? `:${redirect.forward_port}` : '';
        return `${redirect.forward_scheme}://${redirect.forward_domain_name}${port}`;
    };

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                    Redirects ({redirects.length})
                </h2>
                <Button onClick={onRefresh} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Source Domains</TableHead>
                        <TableHead>Forward To</TableHead>
                        <TableHead>Status Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {redirects.map((redirect) => (
                        <TableRow key={redirect.id}>
                            <TableCell>{formatDomains(redirect.domain_names)}</TableCell>
                            <TableCell className="font-mono text-sm">
                                {formatForwardUrl(redirect)}
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary">{redirect.forward_http_code}</Badge>
                            </TableCell>
                            <TableCell>
                                {redirect.enabled ? (
                                    <Badge variant="default" className="bg-green-500">Enabled</Badge>
                                ) : (
                                    <Badge variant="outline">Disabled</Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Redirect?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to delete this redirect? This action cannot be undone.
                                                <div className="mt-2 p-2 bg-muted rounded text-sm font-mono">
                                                    {redirect.domain_names.join(', ')} → {formatForwardUrl(redirect)}
                                                </div>
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => onDelete(redirect.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
