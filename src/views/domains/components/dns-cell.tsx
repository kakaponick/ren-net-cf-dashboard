import { memo } from 'react';
import { Cloud, CloudCheck, CloudOff, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { DNSRecord } from '@/types/cloudflare';
import { cn, copyToClipboard } from '@/lib/utils';

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
						className="h-8 hover:bg-muted cursor-pointer"
						onClick={() => copyToClipboard(record.content, `Copied ${record.content} to clipboard`, 'Failed to copy IP address')}
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
					{record.proxied ? <CloudCheck className="h-4 w-4 text-green-500" /> : <CloudOff className="h-4 w-4 text-gray-500" />}
				</Badge>
			))}
		</div>
	);
});




