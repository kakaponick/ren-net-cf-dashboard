'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, RefreshCw, Globe, X } from 'lucide-react';
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAccountStore } from '@/store/account-store';
import { useCloudflareCache } from '@/store/cloudflare-cache';
import { CloudflareAPI } from '@/lib/cloudflare-api';
import { NameserversSection } from '@/components/nameservers-section';
import { toast } from 'sonner';
import type { DNSRecord } from '@/types/cloudflare';

type DNSDrawerProps = {
	zoneId: string;
	accountId: string;
	zoneName?: string;
	trigger: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export function DNSDrawer({
	zoneId,
	accountId,
	zoneName,
	trigger,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
}: DNSDrawerProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;
	const setOpen = isControlled ? controlledOnOpenChange || (() => {}) : setInternalOpen;

	const { accounts, isLoading: accountsLoading, getDomainNameservers, setDomainNameservers } = useAccountStore();
	const {
		getDNSRecords,
		getZoneDetails,
		setDNSRecords,
		setZoneDetails,
		setLoading,
		isCacheValid,
		isLoading,
		clearZoneCache,
	} = useCloudflareCache();

	const [records, setRecords] = useState<DNSRecord[]>([]);
	const [zone, setZone] = useState<any | null>(null);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isEditing, setIsEditing] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		type: 'A' as DNSRecord['type'],
		name: '',
		content: '',
		ttl: 1,
		proxied: false,
		comment: '',
		priority: 10,
	});

	const account = accounts.find((acc: any) => acc.id === accountId);
	const cacheKey = `${zoneId}-${accountId}`;

	// Get nameservers from zone or store
	const nameservers =
		zone?.name_servers && Array.isArray(zone.name_servers) && zone.name_servers.length > 0
			? zone.name_servers
			: zone?.name
				? getDomainNameservers(zone.name)
				: [];

	useEffect(() => {
		if (open && account && zoneId && accountId && !accountsLoading) {
			// Load zone details
			const cachedZone = getZoneDetails(zoneId, accountId);
			if (cachedZone && isCacheValid('zoneDetails', cacheKey)) {
				setZone(cachedZone);
				if (
					cachedZone?.name_servers &&
					Array.isArray(cachedZone.name_servers) &&
					cachedZone.name_servers.length > 0 &&
					cachedZone?.name
				) {
					setDomainNameservers(cachedZone.name, cachedZone.name_servers);
				}
			} else {
				loadZone();
			}

			// Load DNS records
			const cachedRecords = getDNSRecords(zoneId, accountId);
			if (cachedRecords.length > 0 && isCacheValid('dnsRecords', cacheKey)) {
				setRecords(cachedRecords);
			} else {
				loadRecords();
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, account, zoneId, accountId, accountsLoading]);

	const loadZone = async () => {
		if (!account || !zoneId || !accountId) return;

		setLoading('zoneDetails', cacheKey, true);

		try {
			const api = new CloudflareAPI(account.apiToken);
			const zoneData = await api.getZone(zoneId);
			setZone(zoneData);
			setZoneDetails(zoneId, accountId, zoneData);

			if (
				zoneData?.name_servers &&
				Array.isArray(zoneData.name_servers) &&
				zoneData.name_servers.length > 0 &&
				zoneData?.name
			) {
				setDomainNameservers(zoneData.name, zoneData.name_servers);
			}
		} catch (error) {
			console.error('Error loading zone:', error);
			toast.error('Failed to load zone information');
		} finally {
			setLoading('zoneDetails', cacheKey, false);
		}
	};

	const loadRecords = async (forceRefresh = false) => {
		if (!account || !zoneId || !accountId) return;

		if (!forceRefresh && isCacheValid('dnsRecords', cacheKey)) {
			const cachedRecords = getDNSRecords(zoneId, accountId);
			if (cachedRecords.length > 0) {
				setRecords(cachedRecords);
				return;
			}
		}

		setLoading('dnsRecords', cacheKey, true);
		try {
			const api = new CloudflareAPI(account.apiToken);
			const recordsData = await api.getDNSRecords(zoneId);
			setRecords(recordsData);
			setDNSRecords(zoneId, accountId, recordsData);
		} catch (error) {
			console.error('Error loading DNS records:', error);
			toast.error('Failed to load DNS records');
		} finally {
			setLoading('dnsRecords', cacheKey, false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!account || !zoneId || !accountId) return;

		try {
			const api = new CloudflareAPI(account.apiToken);

			if (isEditing) {
				await api.updateDNSRecord(zoneId, isEditing, formData);
				toast.success('DNS record updated successfully');
			} else {
				await api.createDNSRecord(zoneId, formData);
				toast.success('DNS record created successfully');
			}

			setIsAddDialogOpen(false);
			setIsEditing(null);
			setFormData({
				type: 'A',
				name: '',
				content: '',
				ttl: 1,
				proxied: false,
				comment: '',
				priority: 10,
			});
			clearZoneCache(zoneId, accountId);
			loadRecords(true);
		} catch (error) {
			toast.error(`Failed to save DNS record: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	const handleDelete = async (recordId: string) => {
		if (!account || !zoneId || !accountId) return;

		if (window.confirm('Are you sure you want to delete this DNS record?')) {
			try {
				const api = new CloudflareAPI(account.apiToken);
				await api.deleteDNSRecord(zoneId, recordId);
				toast.success('DNS record deleted successfully');
				clearZoneCache(zoneId, accountId);
				loadRecords(true);
			} catch (error) {
				toast.error('Failed to delete DNS record');
			}
		}
	};

	const handleEdit = (record: DNSRecord) => {
		setFormData({
			type: record.type,
			name: record.name,
			content: record.content,
			ttl: record.ttl,
			proxied: record.proxied,
			comment: record.comment || '',
			priority: record.priority ?? 10,
		});
		setIsEditing(record.id);
		setIsAddDialogOpen(true);
	};

	const resetForm = () => {
		setFormData({
			type: 'A',
			name: '',
			content: '',
			ttl: 1,
			proxied: false,
			comment: '',
			priority: 10,
		});
		setIsEditing(null);
	};

	const getRecordTypeVariant = (type: DNSRecord['type']) => {
		const variants: Record<
			DNSRecord['type'],
			'default' | 'secondary' | 'outline' | 'destructive'
		> = {
			A: 'default',
			AAAA: 'secondary',
			CNAME: 'outline',
			MX: 'secondary',
			TXT: 'outline',
			SRV: 'destructive',
			NS: 'secondary',
			PTR: 'outline',
			CAA: 'secondary',
			LOC: 'outline',
			SSHFP: 'secondary',
			TLSA: 'outline',
			URI: 'secondary',
		};
		return variants[type] || 'secondary';
	};

	const isLoadingRecords = isLoading.dnsRecords[cacheKey] || false;
	const isLoadingZone = isLoading.zoneDetails[cacheKey] || false;

	return (
		<Drawer open={open} onOpenChange={setOpen}>
			<DrawerTrigger asChild>{trigger}</DrawerTrigger>
			<DrawerContent className="max-h-[96vh] flex flex-col" closeDuration={100}>
				<DrawerHeader className="border-b pb-4 px-6 shrink-0">
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<DrawerTitle className="text-xl font-bold flex items-center gap-2">
								<Globe className="h-5 w-5 shrink-0" />
								<span className="truncate">DNS Records</span>
							</DrawerTitle>
							<DrawerDescription className="mt-2 line-clamp-2">
								{zone ? (
									<span>
										Managing DNS records for <strong className="font-semibold">{zone.name}</strong>
										{account && (
											<span className="text-muted-foreground"> ({account.name})</span>
										)}
									</span>
								) : (
									'Loading zone information...'
								)}
							</DrawerDescription>
						</div>
						<DrawerClose asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
								<X className="h-4 w-4" />
							</Button>
						</DrawerClose>
					</div>
				</DrawerHeader>

				<div className="flex-1 min-h-0 px-6 overflow-hidden flex flex-col" style={{ height: 0 }}>
					<div className="space-y-6 py-4 overflow-y-auto flex-1">
						{/* Nameservers Section */}
						{zone && nameservers && nameservers.length > 0 && (
							<Card>
								<CardContent className="pt-6">
									<NameserversSection
										nameservers={nameservers}
										description="Use these Cloudflare nameservers to configure your domain's DNS settings:"
									/>
								</CardContent>
							</Card>
						)}

						{/* DNS Records Section */}
						<div className="space-y-4">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<h3 className="text-lg font-semibold">DNS Records</h3>
								<div className="flex items-center gap-2 flex-wrap">
									<Button
										onClick={() => loadRecords(true)}
										disabled={isLoadingRecords || isLoadingZone}
										variant="outline"
										size="sm"
										className="flex-1 sm:flex-initial"
									>
										<RefreshCw
											className={`h-4 w-4 mr-2 ${
												isLoadingRecords || isLoadingZone ? 'animate-spin' : ''
											}`}
										/>
										Refresh
									</Button>
									<Button
										onClick={() => setIsAddDialogOpen(true)}
										size="sm"
										className="flex-1 sm:flex-initial"
									>
										<Plus className="h-4 w-4 mr-2" />
										Add Record
									</Button>
								</div>
							</div>

							{isLoadingRecords ? (
								<Card>
									<CardContent className="py-12">
										<div className="text-center">
											<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
											<p className="text-sm text-muted-foreground">Loading DNS records...</p>
										</div>
									</CardContent>
								</Card>
							) : records.length === 0 ? (
								<Card>
									<CardContent className="flex flex-col items-center justify-center py-12">
										<Globe className="h-12 w-12 text-muted-foreground mb-4" />
										<h3 className="text-lg font-medium mb-2">No DNS records found</h3>
										<p className="text-muted-foreground mb-4 text-center">
											This zone doesn&apos;t have any DNS records yet
										</p>
										<Button onClick={() => setIsAddDialogOpen(true)} size="sm">
											<Plus className="h-4 w-4 mr-2" />
											Add First Record
										</Button>
									</CardContent>
								</Card>
							) : (
								<Card className="overflow-hidden">
									<div className="overflow-y-auto max-h-[50vh]">
										<Table>
											<TableHeader className="sticky top-0 bg-background z-10 border-b">
												<TableRow>
													<TableHead className="w-[80px] bg-background">Type</TableHead>
													<TableHead className="min-w-[120px] bg-background">Name</TableHead>
													<TableHead className="min-w-[150px] bg-background">Content</TableHead>
													<TableHead className="w-[70px] bg-background">TTL</TableHead>
													<TableHead className="w-[100px] bg-background">Proxy</TableHead>
													<TableHead className="w-[90px] text-right bg-background">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{records.map((record) => (
													<TableRow key={record.id}>
														<TableCell>
															<Badge variant={getRecordTypeVariant(record.type)} className="text-xs">
																{record.type}
															</Badge>
														</TableCell>
														<TableCell className="font-medium font-mono text-sm">
															{record.name}
														</TableCell>
														<TableCell className="font-mono text-sm">
															<span className="break-all block" title={record.content}>
																{record.content}
															</span>
														</TableCell>
														<TableCell className="text-sm">
															{record.ttl === 1 ? 'Auto' : `${record.ttl}s`}
														</TableCell>
														<TableCell>
															<Badge variant={record.proxied ? 'default' : 'secondary'} className="text-xs">
																{record.proxied ? 'Proxied' : 'DNS Only'}
															</Badge>
														</TableCell>
														<TableCell className="text-right">
															<div className="flex items-center justify-end gap-1">
																<Button
																	size="icon"
																	variant="ghost"
																	className="h-8 w-8"
																	onClick={() => handleEdit(record)}
																	title="Edit record"
																>
																	<Edit className="h-4 w-4" />
																</Button>
																<Button
																	size="icon"
																	variant="ghost"
																	className="h-8 w-8 text-destructive hover:text-destructive"
																	onClick={() => handleDelete(record.id)}
																	title="Delete record"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</div>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</Card>
							)}
						</div>
					</div>
				</div>

				<DrawerFooter className="border-t pt-4 px-6 shrink-0">
					<DrawerClose asChild>
						<Button variant="outline" className="w-full">
							Close
						</Button>
					</DrawerClose>
				</DrawerFooter>
			</DrawerContent>

			{/* Add/Edit DNS Record Dialog */}
			<Dialog open={isAddDialogOpen} onOpenChange={(open) => {
				setIsAddDialogOpen(open);
				if (!open) {
					resetForm();
				}
			}}>
				<DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{isEditing ? 'Edit DNS Record' : 'Add DNS Record'}</DialogTitle>
						<DialogDescription>
							{isEditing ? 'Update the DNS record details' : 'Create a new DNS record for this zone'}
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="type">Record Type</Label>
							<Select
								value={formData.type}
								onValueChange={(value) =>
									setFormData({ ...formData, type: value as DNSRecord['type'] })
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="A">A</SelectItem>
									<SelectItem value="AAAA">AAAA</SelectItem>
									<SelectItem value="CNAME">CNAME</SelectItem>
									<SelectItem value="MX">MX</SelectItem>
									<SelectItem value="TXT">TXT</SelectItem>
									<SelectItem value="SRV">SRV</SelectItem>
									<SelectItem value="NS">NS</SelectItem>
									<SelectItem value="PTR">PTR</SelectItem>
									<SelectItem value="CAA">CAA</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								placeholder="subdomain or @"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="content">Content</Label>
							<Input
								id="content"
								placeholder="IP address or domain"
								value={formData.content}
								onChange={(e) => setFormData({ ...formData, content: e.target.value })}
							/>
						</div>

						{formData.type === 'MX' && (
							<div className="space-y-2">
								<Label htmlFor="priority">Priority</Label>
								<Input
									id="priority"
									type="number"
									min="0"
									max="65535"
									placeholder="10"
									value={formData.priority}
									onChange={(e) =>
										setFormData({ ...formData, priority: parseInt(e.target.value) || 10 })
									}
								/>
								<p className="text-xs text-muted-foreground">
									Lower numbers indicate higher priority (0-65535)
								</p>
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="ttl">TTL</Label>
							<Select
								value={formData.ttl.toString()}
								onValueChange={(value) => setFormData({ ...formData, ttl: parseInt(value) })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1">Auto (1)</SelectItem>
									<SelectItem value="300">5 minutes</SelectItem>
									<SelectItem value="600">10 minutes</SelectItem>
									<SelectItem value="1800">30 minutes</SelectItem>
									<SelectItem value="3600">1 hour</SelectItem>
									<SelectItem value="7200">2 hours</SelectItem>
									<SelectItem value="18000">5 hours</SelectItem>
									<SelectItem value="43200">12 hours</SelectItem>
									<SelectItem value="86400">1 day</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-center justify-between space-x-2">
							<div className="space-y-0.5">
								<Label htmlFor="proxied">Cloudflare Proxy</Label>
								<div className="text-sm text-muted-foreground">
									Route traffic through Cloudflare for DDoS protection and caching
								</div>
							</div>
							<Switch
								id="proxied"
								checked={formData.proxied}
								onCheckedChange={(checked) => setFormData({ ...formData, proxied: checked })}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="comment">Comment (optional)</Label>
							<Input
								id="comment"
								placeholder="Description of this record"
								value={formData.comment}
								onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
							/>
						</div>

						<div className="flex justify-end space-x-2 pt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setIsAddDialogOpen(false);
									resetForm();
								}}
							>
								Cancel
							</Button>
							<Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</Drawer>
	);
}

