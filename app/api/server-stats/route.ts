import { NextResponse } from 'next/server';
import { getSSHPool } from './ssh-pool';

interface SSHCredentials {
    host: string;
    port: number;
    username: string;
    privateKey: string;
    passphrase?: string;
}

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

// Combined stats gathering using a single SSH connection and efficient raw file reading
async function getServerStats(credentials: SSHCredentials): Promise<ServerStats> {
    const pool = getSSHPool();

    // Command to read all necessary files twice with a 1 second delay
    // We read: /proc/net/dev (network), /proc/stat (cpu), /proc/meminfo (ram), /proc/cpuinfo (cores check)
    // Structure:
    // [Snapshot 1 of Net & CPU]
    // [MemInfo]
    // [Core Count]
    // [Sleep 1s]
    // [Snapshot 2 of Net & CPU]
    const command = `
        cat /proc/net/dev /proc/stat /proc/meminfo; 
        grep -c processor /proc/cpuinfo;
        sleep 1; 
        echo "===SAMPLE_2==="; 
        cat /proc/net/dev /proc/stat
    `;

    const output = await pool.executeCommand(credentials, command.replace(/\n/g, ' '));
    const lines = output.split('\n');
    const separatorIndex = lines.findIndex(l => l.includes('===SAMPLE_2==='));

    if (separatorIndex === -1) {
        throw new Error('Failed to get second sample');
    }

    const sample1Lines = lines.slice(0, separatorIndex);
    const sample2Lines = lines.slice(separatorIndex + 1);

    // --- PARSING HELPERS ---

    const parseCpuLine = (lines: string[]) => {
        const line = lines.find(l => l.startsWith('cpu '));
        if (!line) return null;
        const parts = line.split(/\s+/).filter(Boolean);
        // /proc/stat: cpu user nice system idle iowait irq softirq steal guest guest_nice
        // Indices:     0   1    2    3      4    5      6   7       8     9     10
        const user = parseInt(parts[1]) || 0;
        const nice = parseInt(parts[2]) || 0;
        const system = parseInt(parts[3]) || 0;
        const idle = parseInt(parts[4]) || 0;
        const iowait = parseInt(parts[5]) || 0;
        const irq = parseInt(parts[6]) || 0;
        const softirq = parseInt(parts[7]) || 0;
        const steal = parseInt(parts[8]) || 0;

        const total = user + nice + system + idle + iowait + irq + softirq + steal;
        const work = total - idle;
        return { total, work };
    };

    const parseMemVal = (key: string) => {
        const line = sample1Lines.find(l => l.startsWith(key));
        if (!line) return 0;
        return parseInt(line.split(/\s+/)[1]) || 0; // kB
    };

    // Auto-detect interface: exclude lo, prioritize standard names or first valid one
    const findInterfaceBytes = (lines: string[]) => {
        // Filter valid interface lines (containing ':') and exclude invalid lines
        const candidates = lines.filter(l => l.includes(':') && !l.trim().startsWith('lo:') && !l.includes('Inter-'));
        // Try to find common primary interfaces first
        let line = candidates.find(l => /eth0|ens|enp|wlan/.test(l));
        // Fallback to first candidate
        if (!line) line = candidates[0];

        if (!line) return { rx: 0, tx: 0 };

        const parts = line.split(':')[1].trim().split(/\s+/);
        return {
            rx: parseInt(parts[0]) || 0,
            tx: parseInt(parts[8]) || 0
        };
    };

    // --- CALCULATIONS ---

    // 1. CPU Parsing
    const cpu1 = parseCpuLine(sample1Lines);
    const cpu2 = parseCpuLine(sample2Lines);
    let cpuUsage = 0;

    if (cpu1 && cpu2) {
        const totalDelta = cpu2.total - cpu1.total;
        const workDelta = cpu2.work - cpu1.work;
        cpuUsage = totalDelta > 0 ? (workDelta / totalDelta) * 100 : 0;
    }

    // Cores - find the single number line in sample1
    const coresLine = sample1Lines.slice(-1)[0]; // grep -c is the last command before sleep
    const cores = parseInt(coresLine) || 1;

    // 2. RAM Parsing
    const memTotal = parseMemVal('MemTotal:');
    const memAvailable = parseMemVal('MemAvailable:'); // Available is better than Free
    // If MemAvailable missing (old kernels), fallback to MemFree + Buffers + Cached (approx)
    const memUsedKb = memTotal - memAvailable;

    const ramStats = {
        used: Math.round((memUsedKb / 1024 / 1024) * 100) / 100, // GB
        total: Math.round((memTotal / 1024 / 1024) * 100) / 100, // GB
        percentage: memTotal > 0 ? Math.round((memUsedKb / memTotal) * 1000) / 10 : 0
    };

    // 3. Network Parsing
    const net1 = findInterfaceBytes(sample1Lines);
    const net2 = findInterfaceBytes(sample2Lines);

    // Calculate B/s
    const rxRate = Math.max(0, net2.rx - net1.rx);
    const txRate = Math.max(0, net2.tx - net1.tx);

    const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B/s`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
    };

    return {
        cpu: {
            usage: Math.round(cpuUsage * 10) / 10,
            cores
        },
        ram: ramStats,
        network: {
            rx: formatBytes(rxRate),
            tx: formatBytes(txRate)
        }
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { serverId } = body;

        if (!serverId) {
            return NextResponse.json(
                { success: false, error: 'Server ID is required' },
                { status: 400 }
            );
        }

        const { credentials } = body as { serverId: string; credentials?: SSHCredentials };

        if (!credentials) {
            return NextResponse.json(
                { success: false, error: 'SSH credentials are required' },
                { status: 400 }
            );
        }

        // Validate credentials
        if (!credentials.host || !credentials.username || !credentials.privateKey) {
            return NextResponse.json(
                { success: false, error: 'Invalid SSH credentials' },
                { status: 400 }
            );
        }

        // Gather stats using connection pool (connections are reused automatically)
        try {
            const stats = await getServerStats(credentials);

            return NextResponse.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error gathering stats:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to gather server statistics' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Server stats API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
