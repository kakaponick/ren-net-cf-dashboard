import { Search, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { NamecheapAccount } from '@/types/namecheap';

interface Stats {
	visible: number;
	total: number;
	selected: number;
}

interface RegistrarPageHeaderProps {
	stats: Stats;
	searchTerm: string;
	onSearchChange: (value: string) => void;
	onClearSearch: () => void;
	onRefresh: () => void;
	isRefreshing: boolean;
	accounts: NamecheapAccount[];
	selectedAccount: string;
	onAccountChange: (value: string) => void;
	domainCounts: Record<string, number>;
}

export function RegistrarPageHeader({
	stats,
	searchTerm,
	onSearchChange,
	onClearSearch,
	onRefresh,
	isRefreshing,
	accounts,
	selectedAccount,
	onAccountChange,
	domainCounts,
}: RegistrarPageHeaderProps) {
	const totalDomains = Object.values(domainCounts).reduce((a, b) => a + b, 0);

	return (
		<div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-3 -mx-6 px-6">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<h1 className="text-xl font-bold">Namecheap</h1>
					<div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
						<span className="px-2 py-0.5 bg-muted/50 rounded border border-border/50">
							<span className="text-foreground font-semibold">{stats.visible}</span>
							{stats.visible !== stats.total && stats.total > 0 && (
								<>
									<span className="text-muted-foreground">/</span>
									<span>{stats.total}</span>
								</>
							)}
							<span className="text-muted-foreground ml-1">domains</span>
						</span>
						{stats.selected > 0 && (
							<span className="px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
								<span className="font-semibold">{stats.selected}</span>
								<span className="text-muted-foreground ml-1">selected</span>
							</span>
						)}
					</div>
				</div>

				<div className="flex items-center space-x-2 flex-nowrap">
					
					<div className="relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
						<Input
							placeholder="Search domains, users"
							value={searchTerm}
							onChange={(e) => onSearchChange(e.target.value)}
							className="pl-10 pr-10 w-96"
						/>
						{searchTerm && (
							<Button
								variant="ghost"
								size="sm"
								className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
								onClick={onClearSearch}
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>

					<Select value={selectedAccount} onValueChange={onAccountChange}>
						<SelectTrigger className="w-xs h-9">
							<SelectValue placeholder="All Accounts" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">
								All Accounts <span className="text-muted-foreground ml-1">({totalDomains})</span>
							</SelectItem>
							{accounts.map((account) => (
								<SelectItem key={account.id} value={account.id}>
									{account.name || account.email}
									<span className="text-muted-foreground ml-2">
										({domainCounts[account.id] || 0})
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Button
						onClick={onRefresh}
						disabled={isRefreshing}
						variant="outline"
						size="sm"
					>
						<RefreshCw className={cn(isRefreshing && 'animate-spin', 'h-4 w-4 mr-2')} />
						{stats.total === 0 ? 'Load Domains' : 'Refresh'}
					</Button>
				</div>
			</div>
		</div>
	);
}
