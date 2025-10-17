import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
		DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue,
} from '@/components/ui/select';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { toast } from 'sonner';
import type { CloudflareAccount } from '@/types/cloudflare';

type AddDomainDialogProps = {
		accounts: CloudflareAccount[];
		onDomainCreated: () => void;
		title: string;
};

export function AddDomainDialog({ title, accounts, onDomainCreated }: AddDomainDialogProps) {
		const [isOpen, setIsOpen] = useState(false);
		const [newDomainName, setNewDomainName] = useState('');
		const [selectedAccountId, setSelectedAccountId] = useState('');
		const [isCreating, setIsCreating] = useState(false);

		const handleCreateDomain = async () => {
				if (!newDomainName.trim()) {
						toast.error('Please enter a domain name');
						return;
				}

				if (!selectedAccountId) {
						toast.error('Please select an account');
						return;
				}

				const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
				if (!domainRegex.test(newDomainName.trim())) {
						toast.error('Please enter a valid domain name (e.g., example.com)');
						return;
				}

				setIsCreating(true);
				try {
						const account = accounts.find(acc => acc.id === selectedAccountId);
						if (!account) {
								toast.error('Selected account not found');
								return;
						}

						const api = new CloudflareAPI(account.apiToken);
						await api.createZone(newDomainName.trim());
						
						toast.success(`Domain "${newDomainName}" created successfully!`);
						
						setNewDomainName('');
						setSelectedAccountId('');
						setIsOpen(false);
						
						onDomainCreated();
				} catch (error) {
						console.error('Error creating domain:', error);
						const errorMessage = error instanceof Error ? error.message : 'Failed to create domain';
						toast.error(errorMessage);
				} finally {
						setIsCreating(false);
				}
		};

		return (
				<Dialog open={isOpen} onOpenChange={setIsOpen}>
						<DialogTrigger asChild title={title}>
								<Button>
										<Plus className="mr-2 h-4 w-4" />
										Add Domain
								</Button>
						</DialogTrigger>
						<DialogContent>
								<DialogHeader>
										<DialogTitle>Add New Domain</DialogTitle>
										<DialogDescription>
												Add a new domain to your Cloudflare account. Select which account to use.
										</DialogDescription>
								</DialogHeader>
								
								<div className="space-y-4 py-4">
										<div className="space-y-2">
												<Label htmlFor="domain-name">Domain Name</Label>
												<Input
														id="domain-name"
														placeholder="example.com"
														value={newDomainName}
														onChange={(e) => setNewDomainName(e.target.value)}
														onKeyDown={(e) => {
																if (e.key === 'Enter' && !isCreating) {
																		handleCreateDomain();
																}
														}}
												/>
										</div>

										<div className="space-y-2">
												<Label htmlFor="account-select">Account</Label>
												<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
														<SelectTrigger id="account-select">
																<SelectValue placeholder="Select an account" />
														</SelectTrigger>
														<SelectContent>
																{accounts.map((account) => (
																		<SelectItem key={account.id} value={account.id}>
																				{account.name} ({account.email})
																		</SelectItem>
																))}
														</SelectContent>
												</Select>
										</div>
								</div>

								<DialogFooter>
										<Button
												variant="outline"
												onClick={() => {
														setIsOpen(false);
														setNewDomainName('');
														setSelectedAccountId('');
												}}
												disabled={isCreating}
										>
												Cancel
										</Button>
										<Button onClick={handleCreateDomain} disabled={isCreating}>
												{isCreating ? (
														<>
																<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
																Creating...
														</>
												) : (
														<>
																<Plus className="mr-2 h-4 w-4" />
																Create Domain
														</>
												)}
										</Button>
								</DialogFooter>
						</DialogContent>
				</Dialog>
		);
}




