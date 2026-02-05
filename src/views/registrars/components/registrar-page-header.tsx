import { Search, RefreshCw, X, Globe, Server, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { NamecheapAccount } from '@/types/namecheap';
import type { NjallaAccount } from '@/types/njalla';
import type { RegistrarType } from '@/types/registrar';
import { ColumnVisibilityMenu, type ColumnVisibilityItem } from '@/components/table/column-visibility-menu';

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
	onRefreshNameservers: () => void;
	isRefreshing: boolean;
	isNameserversLoading?: boolean;
	namecheapAccounts: NamecheapAccount[];
	njallaAccounts: NjallaAccount[];
	selectedAccount: string;
	onAccountChange: (value: string) => void;
	selectedRegistrar: RegistrarType | 'all';
	onRegistrarChange: (value: RegistrarType | 'all') => void;
	domainCounts: Record<string, number>;
	columnVisibilityItems: ColumnVisibilityItem[];
}

export function RegistrarPageHeader({
	stats,
	searchTerm,
	onSearchChange,
	onClearSearch,
	onRefresh,
	onRefreshNameservers,
	isRefreshing,
	isNameserversLoading = false,
	namecheapAccounts,
	njallaAccounts,
	selectedAccount,
	onAccountChange,
	selectedRegistrar,
	onRegistrarChange,
	domainCounts,
	columnVisibilityItems,
}: RegistrarPageHeaderProps) {
	// Filter accounts based on selected registrar
	const filteredNamecheapAccounts =
		selectedRegistrar === 'all' || selectedRegistrar === 'namecheap'
			? namecheapAccounts
			: [];
	const filteredNjallaAccounts =
		selectedRegistrar === 'all' || selectedRegistrar === 'njalla'
			? njallaAccounts
			: [];

	const allAccounts = [...filteredNamecheapAccounts, ...filteredNjallaAccounts];
	const totalDomains = Object.values(domainCounts).reduce((a, b) => a + b, 0);

	// Calculate total domains for filtered accounts
	const namecheapTotalDomains = filteredNamecheapAccounts.reduce(
		(total, account) => total + (domainCounts[account.id] || 0),
		0
	);
	const njallaTotalDomains = filteredNjallaAccounts.reduce(
		(total, account) => total + (domainCounts[account.id] || 0),
		0
	);

	return (
		<div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-3 -mx-6 px-6">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<h1 className="text-xl font-bold">Registrars</h1>
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

					<Select value={selectedRegistrar} onValueChange={onRegistrarChange}>
						<SelectTrigger className="w-xs h-9">
							<SelectValue placeholder="All Registrars" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Registrars</SelectItem>
							<SelectItem value="namecheap">Namecheap</SelectItem>
							<SelectItem value="njalla">Njalla</SelectItem>
						</SelectContent>
					</Select>

					<Select value={selectedAccount} onValueChange={onAccountChange}>
						<SelectTrigger className="w-xs h-9">
							<SelectValue placeholder="All Accounts" />
						</SelectTrigger>
						<SelectContent position="popper" align="end">
							<SelectItem value="all">
								All Accounts <span className="text-muted-foreground ml-1">({totalDomains})</span>
							</SelectItem>

							{/* Namecheap Accounts Group */}
							{filteredNamecheapAccounts.length > 0 && (
								<>
									<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
										Namecheap <span className="text-muted-foreground/60">({namecheapTotalDomains})</span>
									</div>
									{filteredNamecheapAccounts.map((account) => (
										<SelectItem key={account.id} value={account.id} className="pl-4">
											{account.name || account.email}
											<span className="text-muted-foreground ml-2">
												({domainCounts[account.id] || 0})
											</span>
										</SelectItem>
									))}
								</>
							)}

							{/* Njalla Accounts Group */}
							{filteredNjallaAccounts.length > 0 && (
								<>
									<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
										Njalla <span className="text-muted-foreground/60">({njallaTotalDomains})</span>
									</div>
									{filteredNjallaAccounts.map((account) => (
										<SelectItem key={account.id} value={account.id} className="pl-4">
											{account.name || account.email}
											<span className="text-muted-foreground ml-2">
												({domainCounts[account.id] || 0})
											</span>
										</SelectItem>
									))}
								</>
							)}
						</SelectContent>
					</Select>

					<ButtonGroup className="flex">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										onClick={onRefresh}
										disabled={isRefreshing || isNameserversLoading}
										variant="outline"
										size="sm"
										className="px-2"
									>
										All
									</Button>
								</TooltipTrigger>
								<TooltipContent>Refresh domains & nameservers</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										onClick={() => onRefresh()}
										disabled={isRefreshing}
										variant="outline"
										size="sm"
										className="px-2"
									>
										<Globe className={cn("h-3.5 w-3.5", isRefreshing && "animate-pulse")} />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Refresh domains only</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										onClick={onRefreshNameservers}
										disabled={isNameserversLoading}
										variant="outline"
										size="sm"
										className="px-2"
									>
										<Server className={cn("h-3.5 w-3.5", isNameserversLoading && "animate-pulse")} />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Refresh nameservers</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</ButtonGroup>

					<ColumnVisibilityMenu items={columnVisibilityItems} />
				</div>
			</div>
		</div>
	);
}
