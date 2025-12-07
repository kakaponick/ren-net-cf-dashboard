'use client';

import type { JSX } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

const statusCopy: Record<HealthStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: JSX.Element }> = {
		healthy: {
				label: 'Healthy',
				variant: 'default',
				icon: <CheckCircle2 className="h-4 w-4" />
		},
		warning: {
				label: 'Attention',
				variant: 'secondary',
				icon: <AlertTriangle className="h-4 w-4" />
		},
		error: {
				label: 'Unhealthy',
				variant: 'destructive',
				icon: <AlertCircle className="h-4 w-4" />
		}
};

export function DomainHealthCell({ domain, health, error, isLoading, onCheck }: DomainHealthCellProps) {
		const statusMeta = health ? statusCopy[health.status] : null;

		return (
				<div className="flex items-center gap-2">
						<Popover>
								<PopoverTrigger asChild>
										<Button variant="ghost" size="sm" className="h-8 px-2">
												{isLoading ? (
														<Loader2 className="h-4 w-4 animate-spin" />
												) : statusMeta ? (
														<Badge variant={statusMeta.variant} className="inline-flex items-center gap-1">
																{statusMeta.icon}
																{statusMeta.label}
														</Badge>
												) : (
														<Badge variant="outline">Check health</Badge>
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
																				{statusMeta?.icon}
																				{statusMeta?.label}
																		</span>
																}
																message={health.whois.message || health.http.error}
														/>
														<HealthRow
																label="HTTP"
																value={
																		health.http.reachable
																				? `Reachable (${health.http.statusCode ?? '—'})`
																				: 'Unreachable'
																}
																message={health.http.urlTried}
														/>
														<HealthRow
																label="WHOIS"
																value={formatWhoisValue(health)}
																message={health.whois.message}
														/>
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

function formatWhoisValue(health: DomainHealthResult) {
		const { expirationDate, daysToExpire, registrar } = health.whois;
		if (!expirationDate) {
				return 'Date unavailable';
		}

		const parts = [];
		parts.push(new Date(expirationDate).toLocaleDateString());
		if (typeof daysToExpire === 'number') {
				if (daysToExpire < 0) {
						parts.push('(expired)');
				} else {
						parts.push(`(${daysToExpire} days)`);
				}
		}
		if (registrar) {
				parts.push(registrar);
		}

		return parts.join(' ');
}

