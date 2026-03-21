import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';
import { useAccountStore } from '@/store/account-store';
import { toast } from 'sonner';
import type { CloudflareAccount, ProxyAccount } from '@/types/cloudflare';

interface SetNameserversDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	domain: string;
	nameservers: string[];
}

function parseDomain(domain: string) {
	const parts = domain.split('.');
	if (parts.length < 2) {
		throw new Error(`Invalid domain format: ${domain}`);
	}
	return {
		sld: parts.slice(0, -1).join('.'),
		tld: parts[parts.length - 1],
	};
}

function buildNamecheapHeaders(regAccount: CloudflareAccount, proxy: ProxyAccount): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'x-account-id': regAccount.id,
		'x-api-user': regAccount.username || regAccount.email.split('@')[0].replaceAll('.', ''),
		'x-api-key': regAccount.apiToken,
		'x-proxy-host': proxy.host,
		'x-proxy-port': proxy.port?.toString() || '',
	};

	if (proxy.username) headers['x-proxy-username'] = proxy.username;
	if (proxy.password) headers['x-proxy-password'] = proxy.password;

	return headers;
}

export function SetNameserversDialog({ open, onOpenChange, domain, nameservers }: SetNameserversDialogProps) {
	const { accounts, proxyAccounts } = useAccountStore();
	const [selectedAccountId, setSelectedAccountId] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const registrarAccounts = useMemo(() =>
		accounts.filter((a) => a.category === 'registrar' && (a.registrarName === 'namecheap' || a.registrarName === 'njalla')),
		[accounts]
	);

	// Auto-select if only one registrar account
	useEffect(() => {
		if (open && registrarAccounts.length === 1 && !selectedAccountId) {
			setSelectedAccountId(registrarAccounts[0].id);
		}
	}, [open, registrarAccounts, selectedAccountId]);

	// Reset on close
	useEffect(() => {
		if (!open) {
			setSelectedAccountId(registrarAccounts.length === 1 ? registrarAccounts[0].id : '');
		}
	}, [open, registrarAccounts]);

	const handleSubmit = useCallback(async () => {
		const regAccount = registrarAccounts.find((a) => a.id === selectedAccountId);
		if (!regAccount) {
			toast.error('Please select a registrar account');
			return;
		}

		setIsSubmitting(true);
		const loadingToast = toast.loading(`Setting nameservers for ${domain}...`);

		try {
			if (regAccount.registrarName === 'namecheap') {
				if (!regAccount.proxyId) {
					throw new Error(`No proxy assigned to account ${regAccount.name || regAccount.email}`);
				}
				const proxy = proxyAccounts.find((p) => p.id === regAccount.proxyId);
				if (!proxy) {
					throw new Error(`Proxy (id: ${regAccount.proxyId}) not found for account ${regAccount.name || regAccount.email}`);
				}

				const { sld, tld } = parseDomain(domain);
				const response = await fetch('/api/namecheap/nameservers', {
					method: 'POST',
					headers: buildNamecheapHeaders(regAccount, proxy),
					body: JSON.stringify({ sld, tld, nameservers }),
				});
				const data = await response.json();
				if (!response.ok || !data.success) {
					throw new Error(data.error || 'Failed to set nameservers');
				}
			} else if (regAccount.registrarName === 'njalla') {
				const response = await fetch('/api/njalla/nameservers', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': regAccount.apiToken,
					},
					body: JSON.stringify({ domain, nameservers }),
				});
				const data = await response.json();
				if (!response.ok || !data.success) {
					throw new Error(data.error || 'Failed to set nameservers');
				}
			}

			toast.dismiss(loadingToast);
			toast.success(`Nameservers set for ${domain}`);
			onOpenChange(false);
		} catch (error) {
			console.error(`Error setting nameservers for ${domain}:`, error);
			toast.dismiss(loadingToast);
			toast.error(error instanceof Error ? error.message : 'Failed to set nameservers');
		} finally {
			setIsSubmitting(false);
		}
	}, [domain, nameservers, selectedAccountId, registrarAccounts, proxyAccounts, onOpenChange]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Set Nameservers</DialogTitle>
					<DialogDescription>
						Set Cloudflare nameservers at the registrar for <strong>{domain}</strong>
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label>Nameservers</Label>
						<div className="space-y-1.5">
							{nameservers.map((ns) => (
								<div key={ns} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 border">
									<code className="text-xs font-mono flex-1">{ns}</code>
									<CopyButton
										text={ns}
										successMessage={`Copied ${ns}`}
										errorMessage="Failed to copy"
										size="sm"
										className="h-7 w-7 p-0"
										copyIconClassName="h-3 w-3"
										checkIconClassName="h-3 w-3"
									/>
								</div>
							))}
						</div>
					</div>

					{registrarAccounts.length === 0 ? (
						<p className="text-sm text-muted-foreground">No registrar accounts configured. Add a Namecheap or Njalla account first.</p>
					) : (
						<div className="space-y-2">
							<Label>Registrar Account</Label>
							<Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={isSubmitting}>
								<SelectTrigger>
									<SelectValue placeholder="Select registrar account" />
								</SelectTrigger>
								<SelectContent>
									{registrarAccounts.map((acc) => (
										<SelectItem key={acc.id} value={acc.id}>
											{acc.name || acc.email} ({acc.registrarName})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isSubmitting || !selectedAccountId || registrarAccounts.length === 0}
					>
						{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isSubmitting ? 'Setting...' : 'Set Nameservers'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
