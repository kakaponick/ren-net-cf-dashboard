'use client';

import type { JSX } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { DomainHealthResult, HealthStatus } from '@/types/domain-health';

type DomainHealthCellProps = {
		domain: string;
		health: DomainHealthResult | null;
		error?: string | null;
		isLoading: boolean;
		onCheck: (force?: boolean) => Promise<unknown> | void;
};

const statusCopy: Record<HealthStatus, { label: string; colorClass: string; Icon: LucideIcon }> = {
		healthy: {
				label: 'Healthy',
				colorClass: 'text-emerald-600 dark:text-emerald-400',
				Icon: CheckCircle2
		},
		warning: {
				label: 'Attention',
				colorClass: 'text-amber-600 dark:text-amber-400',
				Icon: AlertTriangle
		},
		error: {
				label: 'Unhealthy',
				colorClass: 'text-destructive',
				Icon: AlertCircle
		}
};

export function DomainHealthCell({ domain, health, error, isLoading, onCheck }: DomainHealthCellProps) {
		const derivedStatus = health ? getDerivedStatus(health) : null;
		const statusMeta = derivedStatus ? statusCopy[derivedStatus] : null;
		const isWhoisUnavailable = health ? !health.whois.expirationDate && !health.whois.error : false;
		const redirectMessage = health ? getRedirectMessage(health.http.urlTried, health.http.finalUrl) : undefined;

		return (
				<div className="flex items-center gap-2">
						<Popover>
								<PopoverTrigger asChild>
										<Button variant="ghost" size="sm" className="h-8 px-2 inline-flex items-center gap-2">
												{isLoading ? (
														<Loader2 className="h-4 w-4 animate-spin" />
												) : statusMeta ? (
														<span className="inline-flex items-center gap-2 text-sm font-medium">
																<statusMeta.Icon className={cn('h-4 w-4', statusMeta.colorClass)} />
																<span className={statusMeta.colorClass}>{statusMeta.label}</span>
														</span>
												) : (
														<span className="text-sm text-muted-foreground">Check health</span>
												)}
										</Button>
								</PopoverTrigger>
								<PopoverContent className="w-96" align="start">
										<div className="flex items-center justify-between">
												<div>
														<p className="text-sm font-semibold">Domain health</p>
														<p className="text-xs text-muted-foreground">{domain}</p>
												</div>
												<Button
														size="icon"
														variant="ghost"
														onClick={() => { void onCheck(true); }}
														disabled={isLoading}
														title="Refresh health"
												>
														{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
												</Button>
										</div>

										<Separator className="my-3" />

										{error && (
												<div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
														{error}
												</div>
										)}

										{!error && !health && (
												<p className="text-sm text-muted-foreground">Health has not been checked yet.</p>
										)}

										{health && (
												<div className="space-y-3">
														<HealthRow
																label="Status"
																value={
																		<span className={cn('inline-flex items-center gap-2')}>
																				{statusMeta ? (
																						<statusMeta.Icon className={cn('h-4 w-4', statusMeta.colorClass)} />
																				) : null}
																				<span className={statusMeta?.colorClass}>{statusMeta?.label}</span>
																		</span>
																}
																message={health.http.error}
														/>
														<HealthRow
																label="HTTP"
																value={
																		health.http.reachable
																				? `Reachable (${health.http.statusCode ?? '—'})`
																				: 'Unreachable'
																}
																message={redirectMessage ?? health.http.urlTried}
														/>
														{isWhoisUnavailable && (
																<p className="text-xs text-muted-foreground">
																		WHOIS data unavailable; status is based on HTTP reachability.
																</p>
														)}
														<p className="text-[11px] text-muted-foreground">
																Checked at {new Date(health.checkedAt).toLocaleString()}
														</p>
												</div>
										)}
								</PopoverContent>
						</Popover>

				</div>
		);
}

type HealthRowProps = {
		label: string;
		value: React.ReactNode;
		message?: string | null;
};

function HealthRow({ label, value, message }: HealthRowProps) {
		return (
				<div className="space-y-1 text-sm">
						<p className="text-muted-foreground">{label}</p>
						<div className="font-medium leading-5 break-words">{value}</div>
						{message && <p className="text-xs text-muted-foreground break-words">{message}</p>}
				</div>
		);
}

function getDerivedStatus(health: DomainHealthResult): HealthStatus {
		const whoisUnavailable = !health.whois.expirationDate && !health.whois.error;
		if (health.status === 'warning' && health.http.status === 'healthy' && whoisUnavailable) {
				return 'healthy';
		}
		return health.status;
}

function normalizeUrl(url: string | undefined | null) {
		if (!url) return null;
		try {
				const parsed = new URL(url);
				const pathname = parsed.pathname.endsWith('/') && parsed.pathname !== '/' ? parsed.pathname.slice(0, -1) : parsed.pathname;
				return `${parsed.origin}${pathname}${parsed.search}`;
		} catch {
				return url;
		}
}

function getRedirectMessage(tried?: string, finalUrl?: string) {
		const normTried = normalizeUrl(tried);
		const normFinal = normalizeUrl(finalUrl);
		if (!normFinal || !normTried) return undefined;
		if (normFinal === normTried) return undefined;
		return `Redirected to ${normFinal}`;
}
