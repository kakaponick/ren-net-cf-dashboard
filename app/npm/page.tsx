'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { NPMAPIClient } from '@/lib/npm-api';
import { useAccountStore } from '@/store/account-store';
import { NginxLocationsTable } from '@/views/redirects/components/nginx-locations-table';
import { parseNginxLocations } from '@/lib/nginx-parser';
import { generateUniqueSlug } from '@/lib/slug-generator';
import { AddRedirectDialog } from '@/components/redirects/add-redirect-dialog';
import { extractNginxError, formatNginxError } from '@/lib/nginx-error';
import { RefreshCw, ArrowRightLeft, Settings, ChevronDown } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { NPMRedirectListResponse } from '@/types/npm';
import type { CloudflareAccount } from '@/types/cloudflare';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

export default function NPMPage() {
    const router = useRouter();
    const { accounts, loadAccounts } = useAccountStore();
    const [redirects, setRedirects] = useState<NPMRedirectListResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [npmToken, setNpmToken] = useState<{ token: string; expires: string } | null>(null);
    const [selectedDomain, setSelectedDomain] = useState<string>('all');

    // Load accounts on mount
    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    // Find and decode NPM account (stored as CloudflareAccount with category='npm')
    const npmCredentials = useMemo(() => {
        const npmAcc = accounts.find((acc) => acc.category === 'npm') as CloudflareAccount | undefined;
        if (!npmAcc) return null;

        try {
            const decoded = JSON.parse(npmAcc.apiToken);
            return {
                host: decoded.host as string,
                identity: npmAcc.email,
                secret: decoded.secret as string,
            };
        } catch {
            console.error('Failed to decode NPM credentials');
            return null;
        }
    }, [accounts]);

    const loadRedirects = async (forceRefresh = false) => {
        if (!npmCredentials) {
            return;
        }

        const loading = forceRefresh ? setIsRefreshing : setIsLoading;
        loading(true);

        try {
            const client = new NPMAPIClient(
                npmCredentials,
                npmToken?.token,
                (newToken, expires) => {
                    setNpmToken({ token: newToken, expires });
                }
            );

            const data = await client.getRedirects();
            setRedirects(data);
        } catch (error) {
            console.error('Failed to load redirects:', error);
            toast.error('Failed to load redirects', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            loading(false);
        }
    };

    const handleUpdateLocation = async (index: number, newLocation: string, newDestination: string) => {
        if (!npmCredentials) return;

        try {
            const loc = parsedLocations[index];
            const oldLocation = loc.location;
            const oldDestination = loc.destination;

            // Find the redirect that contains this location
            const redirect = redirects.find(r =>
                r.domain_names.includes(loc.sourceDomain) &&
                r.advanced_config?.includes(oldLocation)
            );

            if (!redirect || !redirect.advanced_config) {
                toast.error('Could not find redirect configuration');
                return;
            }

            // Replace the old location line with the new one in advanced_config
            const oldLine = `location = ${oldLocation} { return 301 ${oldDestination}; }`;
            const newLine = `location = ${newLocation} { return 301 ${newDestination}; }`;
            const updatedConfig = redirect.advanced_config.replace(oldLine, newLine);

            // Update via NPM API
            const client = new NPMAPIClient(
                npmCredentials,
                npmToken?.token,
                (newToken, expires) => {
                    setNpmToken({ token: newToken, expires });
                }
            );

            await client.updateRedirect(redirect.id, {
                domain_names: redirect.domain_names,
                forward_scheme: redirect.forward_scheme,
                forward_domain_name: redirect.forward_domain_name,
                forward_http_code: redirect.forward_http_code,
                certificate_id: redirect.certificate_id,
                meta: {
                    letsencrypt_agree: Boolean(redirect.meta.letsencrypt_agree),
                    dns_challenge: Boolean(redirect.meta.dns_challenge),
                },
                advanced_config: updatedConfig,
                block_exploits: Boolean(redirect.block_exploits),
                preserve_path: Boolean(redirect.preserve_path),
                http2_support: Boolean(redirect.http2_support),
                hsts_enabled: Boolean(redirect.hsts_enabled),
                hsts_subdomains: Boolean(redirect.hsts_subdomains),
                ssl_forced: Boolean(redirect.ssl_forced),
            });

            toast.success('Location updated successfully');
            // Reload redirects to reflect changes
            await loadRedirects(true);
        } catch (error) {
            console.error('Failed to update location:', error);

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
                toast.error('Failed to update location', {
                    description: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
    };

    const handleDeleteLocation = async (index: number) => {
        if (!npmCredentials) return;

        try {
            const loc = parsedLocations[index];

            // Find the redirect that contains this location
            const redirect = redirects.find(r =>
                r.domain_names.includes(loc.sourceDomain) &&
                r.advanced_config?.includes(loc.location)
            );

            if (!redirect || !redirect.advanced_config) {
                toast.error('Could not find redirect configuration');
                return;
            }

            // Remove the location line from advanced_config
            const lineToRemove = `location = ${loc.location} { return 301 ${loc.destination}; }`;
            const updatedConfig = redirect.advanced_config
                .split('\n')
                .filter(line => !line.includes(lineToRemove))
                .join('\n');

            // Update via NPM API
            const client = new NPMAPIClient(
                npmCredentials,
                npmToken?.token,
                (newToken, expires) => {
                    setNpmToken({ token: newToken, expires });
                }
            );

            await client.updateRedirect(redirect.id, {
                domain_names: redirect.domain_names,
                forward_scheme: redirect.forward_scheme,
                forward_domain_name: redirect.forward_domain_name,
                forward_http_code: redirect.forward_http_code,
                certificate_id: redirect.certificate_id,
                meta: {
                    letsencrypt_agree: Boolean(redirect.meta.letsencrypt_agree),
                    dns_challenge: Boolean(redirect.meta.dns_challenge),
                },
                advanced_config: updatedConfig,
                block_exploits: Boolean(redirect.block_exploits),
                preserve_path: Boolean(redirect.preserve_path),
                http2_support: Boolean(redirect.http2_support),
                hsts_enabled: Boolean(redirect.hsts_enabled),
                hsts_subdomains: Boolean(redirect.hsts_subdomains),
                ssl_forced: Boolean(redirect.ssl_forced),
            });

            toast.success('Location deleted successfully');
            // Reload redirects to reflect changes
            await loadRedirects(true);
        } catch (error) {
            console.error('Failed to delete location:', error);

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
                toast.error('Failed to delete location', {
                    description: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
    };

    const handleAddRedirects = async (domain: string, urls: string[]) => {
        if (!npmCredentials) return;

        try {
            const redirect = redirects.find(r => r.domain_names.includes(domain));
            if (!redirect) {
                toast.error('Could not find redirect configuration for domain');
                return;
            }

            // Get all existing locations to check for duplicates
            const existingLocations = parsedLocations.map(loc => loc.location);

            // Generate unique slugs for each URL
            const newLines: string[] = [];
            for (const url of urls) {
                const slug = generateUniqueSlug(existingLocations.concat(newLines.map(line => {
                    const match = line.match(/location = (\/\S+)/);
                    return match ? match[1] : '';
                })));
                const line = `location = /${slug} { return 301 ${url}; }`;
                newLines.push(line);
            }

            // Append new lines to advanced_config
            const currentConfig = redirect.advanced_config || '';
            const updatedConfig = currentConfig + '\n' + newLines.join('\n');

            // Update via NPM API
            const client = new NPMAPIClient(
                npmCredentials,
                npmToken?.token,
                (newToken, expires) => {
                    setNpmToken({ token: newToken, expires });
                }
            );

            await client.updateRedirect(redirect.id, {
                domain_names: redirect.domain_names,
                forward_scheme: redirect.forward_scheme,
                forward_domain_name: redirect.forward_domain_name,
                forward_http_code: redirect.forward_http_code,
                certificate_id: redirect.certificate_id,
                meta: {
                    letsencrypt_agree: Boolean(redirect.meta.letsencrypt_agree),
                    dns_challenge: Boolean(redirect.meta.dns_challenge),
                },
                advanced_config: updatedConfig,
                block_exploits: Boolean(redirect.block_exploits),
                preserve_path: Boolean(redirect.preserve_path),
                http2_support: Boolean(redirect.http2_support),
                hsts_enabled: Boolean(redirect.hsts_enabled),
                hsts_subdomains: Boolean(redirect.hsts_subdomains),
                ssl_forced: Boolean(redirect.ssl_forced),
            });

            // Reload redirects to reflect changes
            await loadRedirects(true);
        } catch (error) {
            console.error('Failed to add redirects:', error);
            throw error; // Re-throw to let dialog handle error display
        }
    };

    // Load redirects when NPM credentials are available
    useEffect(() => {
        if (npmCredentials && !redirects.length) {
            void loadRedirects();
        }
    }, [npmCredentials?.host]);

    // Extract unique source domains from redirects
    const uniqueDomains = useMemo(() => {
        const domains = new Set<string>();
        redirects.forEach((redirect) => {
            redirect.domain_names.forEach((domain) => {
                domains.add(domain);
            });
        });
        return Array.from(domains).sort();
    }, [redirects]);

    // Filter redirects based on selected domain
    const filteredRedirects = useMemo(() => {
        if (selectedDomain === 'all') {
            return redirects;
        }
        return redirects.filter((redirect) =>
            redirect.domain_names.includes(selectedDomain)
        );
    }, [redirects, selectedDomain]);

    // Parse nginx locations from all redirects
    const parseResult = useMemo(() => {
        return parseNginxLocations(filteredRedirects);
    }, [filteredRedirects]);

    const parsedLocations = parseResult.locations;

    // Show error if duplicates are found
    useEffect(() => {
        if (parseResult.domainDuplicates.length > 0) {
            const errorMessage = parseResult.domainDuplicates
                .map((domainDup) =>
                    `${domainDup.domain}: ${domainDup.duplicates.join(', ')}`
                )
                .join('\n');

            toast.error('Duplicate locations detected within domains!', {
                description: `The following domains have duplicate location paths:\n${errorMessage}`,
                duration: 10000,
            });
        }
    }, [parseResult.domainDuplicates]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Page Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-3 -mx-6 px-6">
                <div className="flex items-center justify-between gap-4">

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold">NPM Redirects</h1>
                            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                                {npmCredentials && !isLoading && (
                                    <span className="px-2 py-0.5 bg-muted/50 rounded border border-border/50">
                                        <span className="text-foreground font-semibold">{parsedLocations.length}</span>
                                        <span className="text-muted-foreground ml-1">location{parsedLocations.length !== 1 ? 's' : ''}</span>
                                    </span>
                                )}
                                {npmCredentials && (
                                    <span className="px-2 py-0.5 bg-muted/50 rounded border border-border/50">
                                        <span className="text-foreground font-semibold">1</span>
                                        <span className="text-muted-foreground ml-1">NPM instance</span>
                                    </span>
                                )}
                            </div>
                        </div>


                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                            <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder="Filter by domain" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Domains ({redirects.length})</SelectItem>
                                {uniqueDomains.map((domain) => (
                                    <SelectItem key={domain} value={domain}>
                                        {domain}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <AddRedirectDialog
                            availableDomains={uniqueDomains}
                            initialDomain={selectedDomain !== 'all' ? selectedDomain : undefined}
                            onAdd={handleAddRedirects}
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            {!npmCredentials ? (
                <Empty className="border inline-flex flex-1">
                    <EmptyMedia variant="icon">
                        <ArrowRightLeft className="h-6 w-6" />
                    </EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>No NPM Account Configured</EmptyTitle>
                        <EmptyDescription>
                            Please add an NPM account in the Credentials page to get started.
                        </EmptyDescription>
                    </EmptyHeader>
                    <Button onClick={() => router.push('/credentials')}>
                        Go to Credentials
                    </Button>
                </Empty>
            ) : isLoading || isRefreshing ? (
                <div className="flex items-center justify-center py-12 flex-1">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : redirects.length === 0 ? (
                <Empty className="border inline-flex flex-1">
                    <EmptyMedia variant="icon">
                        <ArrowRightLeft className="h-6 w-6" />
                    </EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>No redirects found</EmptyTitle>
                        <EmptyDescription>
                            Create your first redirect in Nginx Proxy Manager to see it here.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <Card>
                    <div className="overflow-x-auto p-4">
                        <NginxLocationsTable
                            locations={parsedLocations}
                            onUpdate={handleUpdateLocation}
                            onDelete={handleDeleteLocation}
                        />
                    </div>
                </Card>
            )}
        </div>
    );
}
