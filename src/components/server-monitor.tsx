'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccountStore } from '@/store/account-store';
import { Cpu, MemoryStick, Network, Server, AlertCircle, RefreshCw, ChevronDown, Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';

interface ServerStats {
    cpu: {
        usage: number;
        cores: number;
    };
    ram: {
        used: number;
        total: number;
        percentage: number;
    };
    network: {
        rx: string;
        tx: string;
    };
}

interface MonitoredServerStats {
    serverId: string;
    stats: ServerStats | null;
    isLoading: boolean;
    error: string | null;
}

const STORAGE_KEY = 'monitored-servers';

export function ServerMonitor() {
    const { sshAccounts, loadSSHAccounts } = useAccountStore();
    const [monitoredServerIds, setMonitoredServerIds] = useState<string[]>([]);
    const [serverStats, setServerStats] = useState<Map<string, MonitoredServerStats>>(new Map());
    const [isOpen, setIsOpen] = useState(false);

    // Load SSH accounts and monitored servers from localStorage
    useEffect(() => {
        loadSSHAccounts();
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setMonitoredServerIds(Array.isArray(parsed) ? parsed : []);
            } catch (e) {
                console.error('Failed to parse monitored servers', e);
            }
        }
    }, [loadSSHAccounts]);

    // Save monitored servers to localStorage
    useEffect(() => {
        if (monitoredServerIds.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(monitoredServerIds));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [monitoredServerIds]);

    // Fetch stats for a single server
    const fetchServerStats = useCallback(async (serverId: string) => {
        const server = sshAccounts.find(s => s.id === serverId);
        if (!server) return;

        setServerStats(prev => {
            const newMap = new Map(prev);
            newMap.set(serverId, {
                serverId,
                stats: prev.get(serverId)?.stats || null,
                isLoading: true,
                error: null,
            });
            return newMap;
        });

        try {
            const response = await fetch('/api/server-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: server.id,
                    credentials: {
                        host: server.host,
                        port: server.port,
                        username: server.username,
                        privateKey: server.privateKey,
                        passphrase: server.passphrase,
                    },
                }),
            });

            const data = await response.json();

            setServerStats(prev => {
                const newMap = new Map(prev);
                if (data.success) {
                    newMap.set(serverId, {
                        serverId,
                        stats: data.data,
                        isLoading: false,
                        error: null,
                    });
                } else {
                    newMap.set(serverId, {
                        serverId,
                        stats: null,
                        isLoading: false,
                        error: data.error || 'Failed to fetch stats',
                    });
                }
                return newMap;
            });
        } catch (err) {
            setServerStats(prev => {
                const newMap = new Map(prev);
                newMap.set(serverId, {
                    serverId,
                    stats: null,
                    isLoading: false,
                    error: 'Connection error',
                });
                return newMap;
            });
        }
    }, [sshAccounts]);

    // Auto-refresh all monitored servers every 5 seconds
    useEffect(() => {
        if (monitoredServerIds.length === 0) return;

        // Initial fetch
        monitoredServerIds.forEach(id => fetchServerStats(id));

        // Set up interval
        const interval = setInterval(() => {
            monitoredServerIds.forEach(id => fetchServerStats(id));
        }, 5000);

        return () => clearInterval(interval);
    }, [monitoredServerIds, fetchServerStats]);

    // Add server to monitoring
    const addServer = (serverId: string) => {
        if (!monitoredServerIds.includes(serverId)) {
            setMonitoredServerIds(prev => [...prev, serverId]);
        }
    };

    // Remove server from monitoring
    const removeServer = (serverId: string) => {
        setMonitoredServerIds(prev => prev.filter(id => id !== serverId));
        setServerStats(prev => {
            const newMap = new Map(prev);
            newMap.delete(serverId);
            return newMap;
        });
    };

    // Get status color based on percentage
    const getStatusColor = (percentage: number, type: 'cpu' | 'ram'): string => {
        const threshold = type === 'cpu' ? 70 : 75;
        const warningThreshold = type === 'cpu' ? 90 : 90;

        if (percentage >= warningThreshold) return 'bg-red-500';
        if (percentage >= threshold) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    // Get available servers (not yet monitored)
    const availableServers = sshAccounts.filter(
        server => !monitoredServerIds.includes(server.id)
    );

    // Calculate aggregate status for trigger button
    const getAggregateStatus = () => {
        if (monitoredServerIds.length === 0) return null;

        let hasError = false;
        let hasWarning = false;
        let allHealthy = true;

        monitoredServerIds.forEach(id => {
            const serverStat = serverStats.get(id);
            if (serverStat?.error) {
                hasError = true;
                allHealthy = false;
            } else if (serverStat?.stats) {
                const cpuHigh = serverStat.stats.cpu.usage > 90;
                const ramHigh = serverStat.stats.ram.percentage > 90;
                const cpuWarn = serverStat.stats.cpu.usage > 70;
                const ramWarn = serverStat.stats.ram.percentage > 75;

                if (cpuHigh || ramHigh) {
                    hasError = true;
                    allHealthy = false;
                } else if (cpuWarn || ramWarn) {
                    hasWarning = true;
                    allHealthy = false;
                }
            }
        });

        if (hasError) return 'error';
        if (hasWarning) return 'warning';
        if (allHealthy) return 'healthy';
        return null;
    };

    const aggregateStatus = getAggregateStatus();

    // No SSH accounts
    if (sshAccounts.length === 0) {
        return (
            <div className="flex items-center gap-2 h-8 px-3 rounded-md border bg-card text-card-foreground shadow-sm">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-xs ml-1">
                    <Link href="/credentials">Add</Link>
                </Button>
            </div>
        );
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button className="group flex items-center gap-2 h-8 pl-2 pr-3 rounded-md border bg-card/50 text-card-foreground shadow-sm hover:bg-accent/50 hover:text-accent-foreground transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary">
                            <Server className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            {monitoredServerIds.length === 0
                                ? 'Servers'
                                : `${monitoredServerIds.length} Server${monitoredServerIds.length > 1 ? 's' : ''}`
                            }
                        </span>
                    </div>

                    {/* Status indicator */}
                    {monitoredServerIds.length > 0 && (
                        <>
                            <div className="h-4 w-[1px] bg-border mx-1" />
                            <div className={`w-2 h-2 rounded-full ${aggregateStatus === 'error' ? 'bg-red-500' :
                                    aggregateStatus === 'warning' ? 'bg-yellow-500' :
                                        aggregateStatus === 'healthy' ? 'bg-green-500' :
                                            'bg-muted'
                                }`} />
                        </>
                    )}

                    <ChevronDown className="h-3 w-3 text-muted-foreground/50 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-80 p-0 overflow-hidden" align="end" sideOffset={8}>
                {/* Header */}
                <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
                    <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Server Monitor</span>
                    </div>
                    {availableServers.length > 0 && (
                        <Select onValueChange={addServer}>
                            <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent shadow-none focus:ring-0 text-xs font-medium hover:bg-muted/50 rounded-sm px-2">
                                <Plus className="h-3 w-3" />
                                <span>Add</span>
                            </SelectTrigger>
                            <SelectContent align="end">
                                {availableServers.map((server) => (
                                    <SelectItem key={server.id} value={server.id} className="text-xs">
                                        {server.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Content */}
                <div className="max-h-[500px] overflow-y-auto">
                    {monitoredServerIds.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                            <Server className="h-10 w-10 text-muted-foreground/20 mb-3" />
                            <p className="text-sm font-medium mb-1">No Servers Monitored</p>
                            <p className="text-xs text-muted-foreground mb-3">Add servers to monitor their stats</p>
                            {availableServers.length > 0 && (
                                <Select onValueChange={addServer}>
                                    <SelectTrigger className="h-8 w-auto text-xs">
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Server
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableServers.map((server) => (
                                            <SelectItem key={server.id} value={server.id} className="text-xs">
                                                {server.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {monitoredServerIds.map(serverId => {
                                const server = sshAccounts.find(s => s.id === serverId);
                                const serverStat = serverStats.get(serverId);

                                if (!server) return null;

                                return (
                                    <div key={serverId} className="p-3 hover:bg-muted/20 transition-colors">
                                        {/* Server header */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${serverStat?.error ? 'bg-red-500' :
                                                        serverStat?.stats ? 'bg-green-500' :
                                                            'bg-muted animate-pulse'
                                                    }`} />
                                                <span className="text-xs font-medium truncate">{server.name}</span>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                                                onClick={() => removeServer(serverId)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        {/* Stats or Error/Loading */}
                                        {serverStat?.error ? (
                                            <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
                                                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                                <span className="text-[10px] font-medium">{serverStat.error}</span>
                                            </div>
                                        ) : serverStat?.isLoading && !serverStat.stats ? (
                                            <div className="space-y-2">
                                                <div className="h-6 bg-muted/50 rounded animate-pulse" />
                                                <div className="h-12 bg-muted/50 rounded animate-pulse" />
                                            </div>
                                        ) : serverStat?.stats ? (
                                            <div className="space-y-2.5">
                                                {/* CPU & RAM Grid */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    {/* CPU */}
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[9px]">
                                                            <span className="flex items-center gap-1 text-muted-foreground font-medium">
                                                                <Cpu className="h-2.5 w-2.5" /> CPU
                                                            </span>
                                                            <span className="tabular-nums opacity-70">{serverStat.stats.cpu.cores}C</span>
                                                        </div>
                                                        <div className="text-base font-bold tracking-tight tabular-nums leading-none">
                                                            {serverStat.stats.cpu.usage}<span className="text-[9px] font-normal text-muted-foreground ml-0.5">%</span>
                                                        </div>
                                                        <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all duration-500 ease-out ${getStatusColor(serverStat.stats.cpu.usage, 'cpu')}`}
                                                                style={{ width: `${serverStat.stats.cpu.usage}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* RAM */}
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[9px]">
                                                            <span className="flex items-center gap-1 text-muted-foreground font-medium">
                                                                <MemoryStick className="h-2.5 w-2.5" /> RAM
                                                            </span>
                                                            <span className="tabular-nums opacity-70">{serverStat.stats.ram.total}GB</span>
                                                        </div>
                                                        <div className="text-base font-bold tracking-tight tabular-nums leading-none">
                                                            {serverStat.stats.ram.percentage}<span className="text-[9px] font-normal text-muted-foreground ml-0.5">%</span>
                                                        </div>
                                                        <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all duration-500 ease-out ${getStatusColor(serverStat.stats.ram.percentage, 'ram')}`}
                                                                style={{ width: `${serverStat.stats.ram.percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Network */}
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <div className="flex items-center justify-between px-1.5 py-1 rounded bg-muted/30 border border-border/50">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-emerald-500/70" />
                                                            <span className="text-[9px] font-medium text-muted-foreground">RX</span>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-semibold">{serverStat.stats.network.rx}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between px-1.5 py-1 rounded bg-muted/30 border border-border/50">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-blue-500/70" />
                                                            <span className="text-[9px] font-medium text-muted-foreground">TX</span>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-semibold">{serverStat.stats.network.tx}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
