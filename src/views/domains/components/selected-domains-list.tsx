import { Globe, LucideIcon } from 'lucide-react';
import { useAccountStore } from '@/store/account-store';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import { cn } from '@/lib/utils';

interface SelectedDomainsListProps {
	selectedZones: ZoneWithDNS[];
	icon?: LucideIcon;
	title?: string;
	badgeVariant?: 'default' | 'destructive';
	showAccount?: boolean;
	className?: string;
}

export function SelectedDomainsList({
	selectedZones,
	icon: Icon = Globe,
	title = 'Selected Domains',
	badgeVariant = 'default',
	showAccount = false,
	className,
}: SelectedDomainsListProps) {
	const { accounts } = useAccountStore();

	const badgeClassName = badgeVariant === 'destructive' 
		? 'bg-destructive/10 text-destructive'
		: 'bg-primary/10 text-primary';

	return (
		<div className={cn("rounded-lg border bg-muted/50 p-4 space-y-3", className)}>
			<div className="flex items-center justify-between">
				<h4 className="text-sm font-semibold flex items-center gap-2">
					<Icon className="h-4 w-4 text-muted-foreground" />
					<span>{title}</span>
				</h4>
				<span className={cn("text-xs font-medium px-2 py-1 rounded-full", badgeClassName)}>
					{selectedZones.length}
				</span>
			</div>
			<div className="overflow-y-auto max-h-[40vh] pr-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
					{selectedZones.map((zone) => {
						const account = accounts.find(acc => acc.id === zone.accountId);
						return (
							<div
								key={`${zone.accountId}-${zone.zone.id}`}
								className="text-sm text-foreground bg-background/80 px-3 py-2 rounded-md border border-border/50 hover:bg-background transition-colors"
							>
								<div className="font-mono font-medium truncate" title={zone.zone.name}>
									{zone.zone.name}
								</div>
								{showAccount && account && (
								<div className="text-xs text-muted-foreground mt-1 truncate" title={account.name || account.email}>
									{account.name || account.email}
								</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

