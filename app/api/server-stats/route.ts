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

// Get CPU usage using pooled connection
async function getCPUUsage(credentials: SSHCredentials): Promise<{ usage: number; cores: number }> {
    try {
        const pool = getSSHPool();

        // Get CPU usage percentage
        const cpuCommand = `top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//'`;
        const cpuOutput = await pool.executeCommand(credentials, cpuCommand);
        const cpuUsage = parseFloat(cpuOutput) || 0;

        // Get number of CPU cores
        const coresCommand = `nproc`;
        const coresOutput = await pool.executeCommand(credentials, coresCommand);
        const cores = parseInt(coresOutput) || 1;

        return { usage: Math.round(cpuUsage * 10) / 10, cores };
    } catch (error) {
        console.error('Error getting CPU usage:', error);
        return { usage: 0, cores: 1 };
    }
}

// Get RAM usage using pooled connection
async function getRAMUsage(credentials: SSHCredentials): Promise<{ used: number; total: number; percentage: number }> {
    try {
        const pool = getSSHPool();
        const ramCommand = `free -m | awk 'NR==2{printf "%.2f,%.2f", $3/1024,$2/1024}'`;
        const ramOutput = await pool.executeCommand(credentials, ramCommand);
        const [used, total] = ramOutput.split(',').map(parseFloat);

        const percentage = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;

        return {
            used: Math.round(used * 100) / 100,
            total: Math.round(total * 100) / 100,
            percentage
        };
    } catch (error) {
        console.error('Error getting RAM usage:', error);
        return { used: 0, total: 0, percentage: 0 };
    }
}

// Get network usage using pooled connection with real-time sampling
async function getNetworkUsage(credentials: SSHCredentials): Promise<{ rx: string; tx: string }> {
    try {
        const pool = getSSHPool();
        // Command to get network bytes from main interface
        const netCommand = `cat /proc/net/dev | grep -E "eth0|ens|enp|wlan" | head -1 | awk '{printf "%s,%s", $2, $10}'`;

        // First sample
        const sample1 = await pool.executeCommand(credentials, netCommand);
        if (!sample1 || !sample1.includes(',')) {
            return { rx: '0 B/s', tx: '0 B/s' };
        }
        const [rx1, tx1] = sample1.split(',').map(val => parseInt(val) || 0);

        // Wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Second sample
        const sample2 = await pool.executeCommand(credentials, netCommand);
        if (!sample2 || !sample2.includes(',')) {
            return { rx: '0 B/s', tx: '0 B/s' };
        }
        const [rx2, tx2] = sample2.split(',').map(val => parseInt(val) || 0);

        // Calculate bytes per second (difference over 1 second)
        const rxBytesPerSec = Math.max(0, rx2 - rx1);
        const txBytesPerSec = Math.max(0, tx2 - tx1);

        // Format bytes to human readable
        const formatBytes = (bytes: number): string => {
            if (bytes < 1024) return `${bytes} B/s`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
            if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
        };

        return {
            rx: formatBytes(rxBytesPerSec),
            tx: formatBytes(txBytesPerSec)
        };
    } catch (error) {
        console.error('Error getting network usage:', error);
        return { rx: '0 B/s', tx: '0 B/s' };
    }
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
            const [cpu, ram, network] = await Promise.all([
                getCPUUsage(credentials),
                getRAMUsage(credentials),
                getNetworkUsage(credentials)
            ]);

            const stats: ServerStats = {
                cpu,
                ram,
                network
            };

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
