'use client';

import { CalendarClock, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { getDaysToExpiration } from '@/lib/utils';
import type { DomainHealthResult } from '@/types/domain-health';

type DomainExpirationCellProps = {
		domain: string;
		health: DomainHealthResult | null;
		error?: string | null;
		isLoading: boolean;
		onRefresh: (force?: boolean) => Promise<unknown> | void;
};

export function DomainExpirationCell({ domain, health, error, isLoading, onRefresh }: DomainExpirationCellProps) {
		const expirationLabel = formatExpirationLabel(health);
		const expiryBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' =
				!health?.whois.expirationDate
						? 'outline'
						: getExpiryBadgeVariant(health.whois.daysToExpire);

		return (
				<div className="flex items-center gap-2">
						<Popover>
								<PopoverTrigger asChild>
										<Button variant="ghost" size="sm" className="h-8 px-2">
												{isLoading ? (
														<Loader2 className="h-4 w-4 animate-spin" />
												) : (
                          <>
                            <CalendarClock className="h-4 w-4" />
                            {expirationLabel}
                          </>
												)}
										</Button>
								</PopoverTrigger>
								<PopoverContent className="w-96" align="start">
										<div className="flex items-center justify-between">
												<div>
														<p className="text-sm font-semibold">WHOIS expiry</p>
														<p className="text-xs text-muted-foreground">{domain}</p>
												</div>
												<Button
														size="icon"
														variant="ghost"
														onClick={() => { void onRefresh(true); }}
														disabled={isLoading}
														title="Refresh WHOIS"
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
												<p className="text-sm text-muted-foreground">WHOIS has not been checked yet.</p>
										)}

										{health && (
												<div className="space-y-3">
														<InfoRow label="Expiration date" value={expirationLabel} />
														<InfoRow label="Days remaining" value={formatDaysRemaining(health.whois.daysToExpire)} />
														<InfoRow label="Registrar" value={health.whois.registrar || 'Unavailable'} />
														{health.whois.message && (
																<p className="text-xs text-muted-foreground break-words">{health.whois.message}</p>
														)}
												</div>
										)}
								</PopoverContent>
						</Popover>
				</div>
		);
}

type InfoRowProps = {
		label: string;
		value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
		return (
				<div className="space-y-1 text-sm">
						<p className="text-muted-foreground">{label}</p>
						<div className="font-medium leading-5 break-words">{value}</div>
				</div>
		);
}

function formatExpirationLabel(health: DomainHealthResult | null) {
		const expiry = health?.whois.expirationDate;
		if (!expiry) return 'Expiry unknown';

		const days = getDaysToExpiration(expiry);
		const dateText = new Date(expiry).toLocaleDateString();
		if (typeof days === 'number') {
				const suffix = days < 0 ? '(expired)' : `(${days} days)`;
				return `${dateText} ${suffix}`;
		}

		return dateText;
}

function formatDaysRemaining(daysToExpire?: number | null) {
		if (typeof daysToExpire !== 'number') return '—';
		if (daysToExpire < 0) return 'Expired';
		if (daysToExpire === 0) return 'Expires today';
		return `${daysToExpire} day${daysToExpire === 1 ? '' : 's'}`;
}

function getExpiryBadgeVariant(daysToExpire?: number | null): 'default' | 'secondary' | 'destructive' {
		if (typeof daysToExpire !== 'number') return 'secondary';
		if (daysToExpire < 0) return 'destructive';
		if (daysToExpire <= 30) return 'destructive';
		if (daysToExpire <= 90) return 'secondary';
		return 'default';
}

