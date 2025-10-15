import { memo } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { DNSRecord } from '@/types/cloudflare';
import { cn } from '@/lib/utils';

const handleCopyIP = async (ip: string) => {
	try {
		await navigator.clipboard.writeText(ip);
		toast.success(`Copied ${ip} to clipboard`);
	} catch (error) {
		console.error('Failed to copy IP:', error);
		toast.error('Failed to copy IP address');
	}
};

type ARecordsCellProps = {
	rootARecords?: DNSRecord[];
	isLoading?: boolean;
};

export const ARecordsCell = memo(function ARecordsCell({ rootARecords, isLoading }: ARecordsCellProps) {
	if (isLoading) {
		return <Skeleton className="h-4 w-24" />;
	}

	if (!rootARecords || rootARecords.length === 0) {
		return <span className="text-sm text-muted-foreground">No root A record</span>;
	}

	return (
		<div className="space-y-1">
			{rootARecords.map((record, index) => (
				<div key={index} className="flex items-center space-x-2">
					
					<Button
						size="sm"
						variant="ghost"
						className="h-12 hover:bg-muted cursor-pointer"
						onClick={() => handleCopyIP(record.content)}
					>
						<span className="text-sm font-mono text-blue-600 dark:text-blue-400">
						{record.content}
					</span>
						<Copy className="h-3 w-3 opacity-50" />
					</Button>
				</div>
			))}
		</div>
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
					key={index}
					variant="outline"
					className={cn(record.proxied ? 'shadow-green-500' : 'shadow-white text-white', "shadow shrink-0 text-sm")}
					title={record.proxied ? 'Proxied' : 'DNS Only'}
				>
					{record.proxied ? '🟢' : '⚪'}
				</Badge>
			))}
		</div>
	);
});




