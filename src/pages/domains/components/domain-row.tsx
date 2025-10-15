import { memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Settings, RefreshCw } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ARecordsCell, ProxiedCell } from './dns-cell';
import type { ZoneWithDNS } from '../hooks/use-domains-data';
import type { Zone } from '@/types/cloudflare';

type DomainRowProps = {
		item: ZoneWithDNS;
		rowId: string;
		isSelected: boolean;
		onToggle: (rowId: string) => void;
		onRefreshDNS?: (zoneId: string, accountId: string) => void;
		getStatusBadgeVariant: (status: Zone['status']) => 'default' | 'secondary' | 'outline' | 'destructive';
};

export const DomainRow = memo(function DomainRow({ item, rowId, isSelected, onToggle, onRefreshDNS, getStatusBadgeVariant }: DomainRowProps) {
		const handleToggle = useCallback(() => onToggle(rowId), [onToggle, rowId]);
		const handleRefreshDNS = useCallback(() => onRefreshDNS?.(item.zone.id, item.accountId), [onRefreshDNS, item.zone.id, item.accountId]);
		
		return (
				<TableRow>
						<TableCell>
								<Checkbox checked={isSelected} onCheckedChange={handleToggle} />
						</TableCell>
						<TableCell className="font-medium">
								<div className="flex flex-col">
										<div className="flex items-center gap-2">
												<span className="font-semibold">{item.zone.name}</span>
												<a
														href={`https://${item.zone.name}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-muted-foreground hover:text-foreground transition-colors"
														title={`Open ${item.zone.name} in new tab`}
												>
														<ExternalLink className="h-3 w-3" />
												</a>
										</div>
										<span className="text-xs text-muted-foreground">
												{item.zone.name_servers?.length || 0} name servers
										</span>
								</div>
						</TableCell>
						<TableCell>
								<Badge variant={getStatusBadgeVariant(item.zone.status)}>
										{item.zone.status}
								</Badge>
						</TableCell>
						<TableCell>
								<ProxiedCell rootARecords={item.rootARecords} isLoading={item.dnsLoading} />
						</TableCell>
						<TableCell>
								<ARecordsCell rootARecords={item.rootARecords} isLoading={item.dnsLoading} />
						</TableCell>
						<TableCell>
								<span className="text-sm">{item.accountEmail}</span>
						</TableCell>
						<TableCell>
								<span className="text-sm text-muted-foreground">
										{new Date(item.zone.created_on).toLocaleDateString()}
								</span>
						</TableCell>
						<TableCell className="text-right">
								<div className="flex items-center justify-end space-x-2">
										<Button 
												size="icon" 
												variant="ghost"
												onClick={handleRefreshDNS}
												disabled={item.dnsLoading}
												title="Refresh DNS records"
										>
												<RefreshCw className={`h-4 w-4 ${item.dnsLoading ? 'animate-spin' : ''}`} />
										</Button>
										<Button asChild size="sm" variant="outline">
												<Link to={`/dns/${item.zone.id}?account=${item.accountId}`}>
														<Settings className="mr-1 h-3 w-3" />
														DNS
												</Link>
										</Button>
								</div>
						</TableCell>
				</TableRow>
		);
});




