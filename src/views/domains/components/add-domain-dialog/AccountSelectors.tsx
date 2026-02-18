import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { CloudflareAccount } from '@/types/cloudflare';

interface CloudflareAccountOption {
	id: string;
	name: string;
}

export interface RegistrarAccountOption {
	id: string;
	name: string;
	registrar: 'namecheap' | 'njalla';
}

interface AccountSelectorsProps {
	accounts: CloudflareAccount[];
	cloudflareAccounts: CloudflareAccountOption[];
	selectedAccountId: string;
	selectedCloudflareAccountId: string;
	isLoadingAccounts: boolean;
	onAccountChange: (accountId: string) => void;
	onCloudflareAccountChange: (accountId: string) => void;
	disabled?: boolean;
	// Registrar (optional)
	registrarAccounts?: RegistrarAccountOption[];
	selectedRegistrarAccountId?: string;
	onRegistrarAccountChange?: (accountId: string) => void;
}

function NamecheapLogo({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			xmlnsXlink="http://www.w3.org/1999/xlink"
			viewBox="0 -57 256 256"
			className={className}
			aria-label="Namecheap"
		>
			<defs>
				<linearGradient x1="13.322%" y1="94.945%" x2="82.62%" y2="1.132%" id="nc-lg1">
					<stop stopColor="#D4202C" offset="0%" />
					<stop stopColor="#D82D2B" stopOpacity="0.9583" offset="4.166%" />
					<stop stopColor="#E25226" stopOpacity="0.824" offset="17.6%" />
					<stop stopColor="#EB7123" stopOpacity="0.6833" offset="31.67%" />
					<stop stopColor="#F28920" stopOpacity="0.5365" offset="46.35%" />
					<stop stopColor="#F69A1E" stopOpacity="0.3812" offset="61.88%" />
					<stop stopColor="#F9A41D" stopOpacity="0.2114" offset="78.86%" />
					<stop stopColor="#FAA71D" stopOpacity="0" offset="100%" />
				</linearGradient>
				<linearGradient x1="86.624%" y1="5.04%" x2="17.326%" y2="98.855%" id="nc-lg2">
					<stop stopColor="#D4202C" offset="0%" />
					<stop stopColor="#D82D2B" stopOpacity="0.9583" offset="4.166%" />
					<stop stopColor="#E25226" stopOpacity="0.824" offset="17.6%" />
					<stop stopColor="#EB7123" stopOpacity="0.6833" offset="31.67%" />
					<stop stopColor="#F28920" stopOpacity="0.5365" offset="46.35%" />
					<stop stopColor="#F69A1E" stopOpacity="0.3812" offset="61.88%" />
					<stop stopColor="#F9A41D" stopOpacity="0.2114" offset="78.86%" />
					<stop stopColor="#FAA71D" stopOpacity="0" offset="100%" />
				</linearGradient>
			</defs>
			<g>
				<path d="M232,0 C223,0 215.2,5 211.1,12.3 L210.6,13.3 L191.8,50.3 L168,97.2 L183.6,127.9 L184.5,129.6 C186.9,133.8 190.5,137.3 194.9,139.4 C199.3,137.2 202.9,133.8 205.3,129.6 L206.2,127.9 L252.9,35.9 L254,33.7 C255.3,30.7 256,27.5 256,24 C256,10.7 245.3,0 232,0 Z" fill="#FF5000" />
				<path d="M87.9,44.6 L72.4,14 L71.5,12.3 C69.1,8.1 65.5,4.6 61.1,2.5 C56.7,4.7 53.1,8.1 50.7,12.3 L49.9,14 L3.2,106 L2.1,108.2 C0.8,111.2 0.1,114.4 0.1,117.9 C0.1,131.1 10.8,141.9 24.1,141.9 C33.1,141.9 40.9,136.9 45,129.6 L45.5,128.6 L64.3,91.6 L88,44.7 Z" fill="#FF5000" />
				<path d="M232,0 C223,0 215.1,5 211.1,12.3 L210.6,13.3 L191.8,50.3 L168,97.2 L183.6,127.9 L184.5,129.6 C186.9,133.8 190.5,137.3 194.9,139.4 C199.3,137.2 202.9,133.8 205.3,129.6 L206.2,127.9 L252.9,35.9 L254,33.7 C255.3,30.7 256,27.5 256,24 C256,10.7 245.2,0 232,0 Z" fill="url(#nc-lg1)" />
				<path d="M24,141.9 C33,141.9 40.9,136.9 44.9,129.6 L45.4,128.6 L64.2,91.6 L88,44.7 L72.4,14 L71.5,12.3 C69.1,8.1 65.5,4.6 61.1,2.5 C56.7,4.7 53.1,8.1 50.7,12.3 L49.9,14 L3.2,106 L2,108.3 C0.7,111.3 0,114.5 0,118 C0,131.2 10.7,141.9 24,141.9 Z" fill="url(#nc-lg2)" />
				<path d="M87.9,44.6 L72.4,14 L71.5,12.3 C69.1,8.1 65.5,4.6 61.1,2.5 C62.5,1.8 64.1,1.2 65.6,0.8 C67.5,0.3 69.6,0 71.6,0 L104,0 L104.4,0 C113.4,0.1 121.2,5 125.3,12.3 L126,14 L168.1,97.3 L183.6,127.9 L184.5,129.6 C186.9,133.8 190.5,137.3 194.9,139.4 C193.5,140.1 191.9,140.7 190.4,141.1 C188.5,141.6 186.4,141.9 184.3,141.9 L152.1,141.9 L151.7,141.9 C142.7,141.8 134.9,136.9 130.8,129.6 L129.9,127.9 Z" fill="#FF8C44" />
			</g>
		</svg>
	);
}

function NjallaLogo({ className }: { className?: string }) {
	// Extracted from https://njal.la/static/img/njalla.svg — the teal lambda mark (Fill-8)
	return (
		<svg
			viewBox="0 0 24 27"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-label="Njalla"
		>
			<polygon
				fill="#19D6AC"
				points="3.92,26.05 0,26.05 11.94,0 23.45,26.05 19.47,26.05 11.87,8.29 8.12,16.62"
			/>
		</svg>
	);
}

function RegistrarIcon({ registrar, className }: { registrar: 'namecheap' | 'njalla'; className?: string }) {
	if (registrar === 'namecheap') {
		return <NamecheapLogo className={className} />;
	}
	return <NjallaLogo className={className} />;
}

export function AccountSelectors({
	accounts,
	cloudflareAccounts,
	selectedAccountId,
	selectedCloudflareAccountId,
	isLoadingAccounts,
	onAccountChange,
	onCloudflareAccountChange,
	disabled,
	registrarAccounts = [],
	selectedRegistrarAccountId = '',
	onRegistrarAccountChange,
}: AccountSelectorsProps) {
	const [registrarOpen, setRegistrarOpen] = React.useState(false);

	const selectedRegistrar = registrarAccounts.find((a) => a.id === selectedRegistrarAccountId);

	return (
		<>
			<div className="space-y-2">
				<Label htmlFor="account-select">API Account</Label>
				<Select value={selectedAccountId} onValueChange={onAccountChange} disabled={disabled}>
					<SelectTrigger id="account-select">
						<SelectValue placeholder="Select an API account" />
					</SelectTrigger>
					<SelectContent>
						{accounts.map((account) => (
							<SelectItem key={account.id} value={account.id}>
								{account.name || account.email}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{selectedAccountId && (
				<div className="space-y-2 hidden">
					<Label htmlFor="cloudflare-account-select">Cloudflare Account</Label>
					<Select
						value={selectedCloudflareAccountId}
						onValueChange={onCloudflareAccountChange}
						disabled={isLoadingAccounts || disabled}
					>
						<SelectTrigger id="cloudflare-account-select">
							<SelectValue
								placeholder={
									isLoadingAccounts
										? 'Loading accounts...'
										: cloudflareAccounts.length === 0
											? 'No accounts found'
											: 'Select a Cloudflare account'
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{cloudflareAccounts.map((cfAccount) => (
								<SelectItem key={cfAccount.id} value={cfAccount.id}>
									{cfAccount.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{registrarAccounts.length > 0 && onRegistrarAccountChange && (
				<div className="space-y-2">
					<Label>
						Registrar Account
						<span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional — auto-sets nameservers)</span>
					</Label>
					<Popover open={registrarOpen} onOpenChange={setRegistrarOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								role="combobox"
								aria-expanded={registrarOpen}
								disabled={disabled}
								className="w-full justify-between"
							>
								{selectedRegistrar ? (
									<span className="flex items-center gap-2 truncate">
										<RegistrarIcon registrar={selectedRegistrar.registrar} className="h-4 w-4 shrink-0" />
										<span className="truncate">{selectedRegistrar.name}</span>
									</span>
								) : (
									<span className="text-muted-foreground">None (skip)</span>
								)}
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
							<Command>
								<CommandInput placeholder="Search registrar account..." />
								<CommandList>
									<CommandEmpty>No registrar accounts found.</CommandEmpty>
									<CommandGroup>
										<CommandItem
											value="__none__"
											onSelect={() => { onRegistrarAccountChange(''); setRegistrarOpen(false); }}
											className="flex items-center justify-between"
										>
											<span className="text-muted-foreground">None (skip)</span>
											<Check className={cn('ml-2 h-4 w-4', !selectedRegistrarAccountId ? 'opacity-100' : 'opacity-0')} />
										</CommandItem>
										{registrarAccounts.map((acc) => (
											<CommandItem
												key={acc.id}
												value={`${acc.name} ${acc.registrar}`}
												onSelect={() => { onRegistrarAccountChange(acc.id); setRegistrarOpen(false); }}
												className="flex items-center justify-between"
											>
												<span className="flex items-center gap-2">
													<RegistrarIcon registrar={acc.registrar} className="h-4 w-4 shrink-0" />
													<span>{acc.name}</span>
												</span>
												<Check className={cn('ml-2 h-4 w-4', selectedRegistrarAccountId === acc.id ? 'opacity-100' : 'opacity-0')} />
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				</div>
			)}
		</>
	);
}
