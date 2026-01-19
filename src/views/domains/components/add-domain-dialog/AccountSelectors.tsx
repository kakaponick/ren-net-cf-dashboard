import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { CloudflareAccount } from '@/types/cloudflare';

interface CloudflareAccountOption {
	id: string;
	name: string;
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
}

export function AccountSelectors({
	accounts,
	cloudflareAccounts,
	selectedAccountId,
	selectedCloudflareAccountId,
	isLoadingAccounts,
	onAccountChange,
	onCloudflareAccountChange,
	disabled
}: AccountSelectorsProps) {
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
				<div className="space-y-2">
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
		</>
	);
}

