import { memo, useState, useEffect, useCallback } from 'react';
import { CloudCheck, CloudOff, Plus, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CopyButton } from '@/components/ui/copy-button';
import { RootARecordForm } from './root-a-record-form';
import { useRootARecord } from '@/hooks/use-root-a-record';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { DNSRecord } from '@/types/cloudflare';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ARecordsCellProps = {
	rootARecords?: DNSRecord[];
	isLoading?: boolean;
	zoneId?: string;
	accountId?: string;
	zoneName?: string;
	onRefreshDNS?: (zoneId: string, accountId: string) => void;
};

function ARecordDisplay({ record }: { record: DNSRecord }) {
	return (
		<CopyButton
			text={record.content}
			successMessage={`Copied ${record.content} to clipboard`}
			errorMessage="Failed to copy IP address"
			size="sm"
			className="h-8 hover:bg-muted cursor-pointer"
		>
			<span className="text-sm font-mono text-blue-600 dark:text-blue-400">
				{record.content}
			</span>
		</CopyButton>
	);
}

function EmptyARecordTrigger({ 
	canEdit,
	onClick
}: { 
	canEdit: boolean;
	onClick?: () => void;
}) {
	if (!canEdit) {
		return (
			<span
				className="text-sm text-muted-foreground cursor-not-allowed opacity-50"
				title="Zone information not available"
			>
				No root A record
			</span>
		);
	}

	return (
		<Button
			size="sm"
			variant="ghost"
			className="h-8 hover:bg-muted cursor-pointer"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onClick?.();
			}}
			title="Click to add root A record"
		>
			<span className="text-sm text-muted-foreground">No root A record</span>
			<Plus className="h-3 w-3 opacity-50" />
		</Button>
	);
}

function RootARecordPopover({
	isOpen,
	onOpenChange,
	ipAddress,
	proxied,
	isProcessing,
	onIPChange,
	onProxiedChange,
	onSubmit,
	onCancel,
	mode,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	ipAddress: string;
	proxied: boolean;
	isProcessing: boolean;
	onIPChange: (ip: string) => void;
	onProxiedChange: (proxied: boolean) => void;
	onSubmit: () => void;
	onCancel: () => void;
	mode: 'create' | 'edit';
}) {
	return (
		<PopoverContent className="w-80" align="start">
			<div className="space-y-4">
				<div className="space-y-2">
					<h4 className="font-medium text-sm">
						{mode === 'create' ? 'Add Root A Record' : 'Edit Root A Record'}
					</h4>
					<p className="text-xs text-muted-foreground">
						{mode === 'create'
							? 'Create a root A record (@) for this domain'
							: 'Update the root A record (@) for this domain'}
					</p>
				</div>
				<RootARecordForm
					ipAddress={ipAddress}
					proxied={proxied}
					isProcessing={isProcessing}
					onIPChange={onIPChange}
					onProxiedChange={onProxiedChange}
					onSubmit={onSubmit}
					onCancel={onCancel}
					autoFocus={isOpen}
				/>
			</div>
		</PopoverContent>
	);
}

export const ARecordsCell = memo(function ARecordsCell({
	rootARecords,
	isLoading,
	zoneId,
	accountId,
	zoneName,
	onRefreshDNS,
}: ARecordsCellProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
	const [ipAddress, setIpAddress] = useState('');
	const [proxied, setProxied] = useState(false);

	const { createRecord, updateRecord, isProcessing, canEdit } = useRootARecord({
		zoneId,
		accountId,
		onSuccess: (zoneId, accountId) => {
			setIsOpen(false);
			resetForm();
			onRefreshDNS?.(zoneId, accountId);
		},
	});

	const resetForm = (forCreate = false) => {
		setIpAddress('');
		setProxied(forCreate);
		setEditingRecord(null);
	};

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (open) {
			resetForm(true);
		}
	};

	const handleTriggerClick = () => {
		resetForm(true);
		setIsOpen(true);
	};

	const handleOpenEdit = (record: DNSRecord) => {
		setEditingRecord(record);
		setIpAddress(record.content);
		setProxied(record.proxied);
		setIsOpen(true);
	};

	const handleSubmit = async () => {
		if (editingRecord) {
			const success = await updateRecord(editingRecord.id, ipAddress, proxied);
			if (success) {
				resetForm();
			}
		} else {
			await createRecord(ipAddress, proxied);
		}
	};

	const handleCancel = () => {
		setIsOpen(false);
		resetForm();
	};

	useEffect(() => {
		if (!isOpen) {
			resetForm(false);
		}
	}, [isOpen]);

	if (isLoading) {
		return <Skeleton className="h-4 w-24" />;
	}

	if (!rootARecords || rootARecords.length === 0) {
		if (!canEdit) {
			return (
				<span className="text-sm text-muted-foreground cursor-not-allowed opacity-50">
					No root A record
				</span>
			);
		}

		return (
			<Popover open={isOpen} onOpenChange={(open) => {
				setIsOpen(open);
				if (open) {
					resetForm(true);
				} else {
					resetForm(false);
				}
			}}>
				<PopoverTrigger asChild>
					<Button
						size="sm"
						variant="ghost"
						className="h-8 hover:bg-muted cursor-pointer"
						title="Click to add root A record"
					>
						<span className="text-sm text-muted-foreground">No root A record</span>
						<Plus className="h-3 w-3 opacity-50" />
					</Button>
				</PopoverTrigger>
				<RootARecordPopover
					isOpen={isOpen}
					onOpenChange={(open) => {
						setIsOpen(open);
						if (!open) {
							resetForm(false);
						}
					}}
					ipAddress={ipAddress}
					proxied={proxied}
					isProcessing={isProcessing}
					onIPChange={setIpAddress}
					onProxiedChange={setProxied}
					onSubmit={handleSubmit}
					onCancel={handleCancel}
					mode="create"
				/>
			</Popover>
		);
	}

	return (
		<>
			<div className="space-y-1">
				{rootARecords.map((record, index) => (
					<div key={`${record.id}-${index}`} className="flex items-center gap-2">
						<ARecordDisplay record={record} />
						{canEdit && (
							<Popover open={isOpen && editingRecord?.id === record.id} onOpenChange={(open) => {
								if (!open) {
									setIsOpen(false);
									resetForm(false);
								}
							}}>
								<PopoverTrigger asChild>
									<Button
										size="icon"
										variant="ghost"
										className="h-8 w-8"
										onClick={() => handleOpenEdit(record)}
										title="Edit A record"
									>
										<Pencil className="h-3 w-3 opacity-50" />
									</Button>
								</PopoverTrigger>
								<RootARecordPopover
									isOpen={isOpen && editingRecord?.id === record.id}
									onOpenChange={setIsOpen}
									ipAddress={ipAddress}
									proxied={proxied}
									isProcessing={isProcessing}
									onIPChange={setIpAddress}
									onProxiedChange={setProxied}
									onSubmit={handleSubmit}
									onCancel={handleCancel}
									mode="edit"
								/>
							</Popover>
						)}
					</div>
				))}
			</div>
		</>
	);
});

type ProxiedCellProps = {
	rootARecords?: DNSRecord[];
	isLoading?: boolean;
};

export const ProxiedCell = memo(function ProxiedCell({ rootARecords, isLoading }: ProxiedCellProps) {
	if (isLoading) {
		return <Skeleton className="h-6 w-10" />;
	}

	if (!rootARecords || rootARecords.length === 0) {
		return <span className="text-sm text-muted-foreground">-</span>;
	}

	return (
		<div className="flex items-center gap-1">
			{rootARecords.map((record, index) => (
				<Badge
					key={`${record.id}-${index}`}
					variant="outline"
					className={cn(
						record.proxied ? 'shadow-green-500' : 'shadow-white text-white',
						"shadow shrink-0 text-sm"
					)}
					title={record.proxied ? 'Proxied' : 'DNS Only'}
				>
					{record.proxied ? (
						<CloudCheck className="h-4 w-4 text-green-500" />
					) : (
						<CloudOff className="h-4 w-4 text-gray-500" />
					)}
				</Badge>
			))}
		</div>
	);
});

type SSLTlsCellProps = {
	zoneId: string;
	accountId: string;
	zoneName: string;
	isLoading?: boolean;
	currentMode?: string;
	onModeChange?: () => void;
};

const SSL_TLS_MODES = [
	{
		value: 'off',
		label: 'Off (not secure)',
		description: 'No encryption applied'
	},
	{
		value: 'flexible',
		label: 'Flexible',
		description: 'HTTPS to visitors, HTTP to origin'
	},
	{
		value: 'full',
		label: 'Full',
		description: 'End-to-end encryption'
	},
	{
		value: 'strict',
		label: 'Full (Strict)',
		description: 'Enforce valid origin certificate'
	}
];

export const SSLTlsCell = memo(function SSLTlsCell({
	zoneId,
	accountId,
	zoneName,
	isLoading,
	currentMode = 'strict',
	onModeChange
}: SSLTlsCellProps) {
	const [isUpdating, setIsUpdating] = useState(false);
	const [selectedMode, setSelectedMode] = useState(currentMode);

	const handleModeChange = useCallback(async (newMode: string) => {
		setSelectedMode(newMode);
		setIsUpdating(true);

		try {
			const { CloudflareAPI } = await import('@/lib/cloudflare-api');
			const { useAccountStore } = await import('@/store/account-store');
			const store = useAccountStore.getState();
			const account = store.accounts.find(acc => acc.id === accountId);

			if (!account) {
				toast.error('Account not found');
				setSelectedMode(currentMode);
				return;
			}

			const api = new CloudflareAPI(account.apiToken);
			await api.setSSLMode(zoneId, newMode as 'off' | 'flexible' | 'full' | 'strict');
			
			toast.success(`SSL/TLS mode updated to ${SSL_TLS_MODES.find(m => m.value === newMode)?.label}`, {
				description: `Domain: ${zoneName}`
			});
			
			onModeChange?.();
		} catch (error) {
			console.error('Error updating SSL/TLS mode:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to update SSL/TLS mode';
			toast.error(errorMessage, {
				description: `Domain: ${zoneName}`
			});
			setSelectedMode(currentMode);
		} finally {
			setIsUpdating(false);
		}
	}, [zoneId, accountId, zoneName, currentMode, onModeChange]);

	if (isLoading) {
		return <Skeleton className="h-6 w-24" />;
	}

	const currentModeConfig = SSL_TLS_MODES.find(m => m.value === selectedMode);
	const displayLabel = currentModeConfig?.label.split('(')[0].trim() || 'Select mode';

	return (
		<Select 
			value={selectedMode} 
			onValueChange={handleModeChange}
			disabled={isUpdating}
		>
			<SelectTrigger className="h-8 w-40 text-xs">
				{isUpdating ? (
					<div className="flex items-center gap-1.5">
						<Loader2 className="h-3 w-3 animate-spin" />
						<span>Updating</span>
					</div>
				) : (
					<SelectValue placeholder={displayLabel} />
				)}
			</SelectTrigger>
			<SelectContent className="">
				{SSL_TLS_MODES.map((mode) => (
					<SelectItem key={mode.value} value={mode.value} className="cursor-pointer">
						<div className="flex flex-col gap-1">
							<span className="font-medium text-sm">{mode.label}</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
});
