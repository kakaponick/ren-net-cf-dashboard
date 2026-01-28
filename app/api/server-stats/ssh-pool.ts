import { Client } from 'ssh2';

interface SSHCredentials {
    host: string;
    port: number;
    username: string;
    privateKey: string;
    passphrase?: string;
}

interface PooledConnection {
    client: Client;
    credentials: SSHCredentials;
    lastUsed: number;
    isConnecting: boolean;
}

class SSHConnectionPool {
    private pool: Map<string, PooledConnection> = new Map();
    private readonly MAX_IDLE_TIME = 5 * 60 * 1000; // 5 minutes
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Start cleanup interval to remove stale connections
        this.startCleanup();
    }

    /**
     * Generate a unique key for a server connection
     */
    private getConnectionKey(credentials: SSHCredentials): string {
        return `${credentials.host}:${credentials.port}:${credentials.username}`;
    }

    /**
     * Create a new SSH connection
     */
    private async createConnection(credentials: SSHCredentials): Promise<Client> {
        return new Promise((resolve, reject) => {
            const client = new Client();

            client.on('ready', () => {
                console.log(`[SSH Pool] Connected to ${credentials.host}:${credentials.port}`);
                resolve(client);
            });

            client.on('error', (err) => {
                console.error(`[SSH Pool] Connection error for ${credentials.host}:${credentials.port}:`, err.message);
                reject(err);
            });

            client.on('close', () => {
                console.log(`[SSH Pool] Connection closed for ${credentials.host}:${credentials.port}`);
                // Remove from pool when closed
                const key = this.getConnectionKey(credentials);
                this.pool.delete(key);
            });

            client.connect({
                host: credentials.host,
                port: credentials.port,
                username: credentials.username,
                privateKey: credentials.privateKey,
                passphrase: credentials.passphrase,
                readyTimeout: 30000,
                keepaliveInterval: 10000, // Send keepalive every 10 seconds
                keepaliveCountMax: 3, // Close after 3 failed keepalives
            });
        });
    }

    /**
     * Get or create a connection from the pool
     */
    async getConnection(credentials: SSHCredentials): Promise<Client> {
        const key = this.getConnectionKey(credentials);
        const pooled = this.pool.get(key);

        // If we have an existing connection that's still alive, reuse it
        if (pooled && !pooled.isConnecting) {
            // Update last used time
            pooled.lastUsed = Date.now();
            console.log(`[SSH Pool] Reusing connection for ${credentials.host}:${credentials.port}`);
            return pooled.client;
        }

        // If connection is being established, wait for it
        if (pooled?.isConnecting) {
            console.log(`[SSH Pool] Waiting for pending connection to ${credentials.host}:${credentials.port}`);
            // Wait a bit and retry
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.getConnection(credentials);
        }

        // Create new connection
        console.log(`[SSH Pool] Creating new connection to ${credentials.host}:${credentials.port}`);

        // Mark as connecting
        this.pool.set(key, {
            client: new Client(),
            credentials,
            lastUsed: Date.now(),
            isConnecting: true,
        });

        try {
            const client = await this.createConnection(credentials);

            // Update pool with ready connection
            this.pool.set(key, {
                client,
                credentials,
                lastUsed: Date.now(),
                isConnecting: false,
            });

            return client;
        } catch (error) {
            // Remove failed connection from pool
            this.pool.delete(key);
            throw error;
        }
    }

    /**
     * Execute a command on a pooled connection
     */
    async executeCommand(credentials: SSHCredentials, command: string): Promise<string> {
        const client = await this.getConnection(credentials);

        return new Promise((resolve, reject) => {
            client.exec(command, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }

                let output = '';
                stream.on('data', (data: Buffer) => {
                    output += data.toString();
                });

                stream.on('close', () => {
                    resolve(output.trim());
                });

                stream.stderr.on('data', (data: Buffer) => {
                    console.error('[SSH Command] STDERR:', data.toString());
                });
            });
        });
    }

    /**
     * Close a specific connection
     */
    closeConnection(credentials: SSHCredentials): void {
        const key = this.getConnectionKey(credentials);
        const pooled = this.pool.get(key);

        if (pooled) {
            pooled.client.end();
            this.pool.delete(key);
            console.log(`[SSH Pool] Closed connection for ${credentials.host}:${credentials.port}`);
        }
    }

    /**
     * Start cleanup interval to remove stale connections
     */
    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const staleKeys: string[] = [];

            for (const [key, pooled] of this.pool.entries()) {
                if (now - pooled.lastUsed > this.MAX_IDLE_TIME) {
                    staleKeys.push(key);
                }
            }

            // Close stale connections
            for (const key of staleKeys) {
                const pooled = this.pool.get(key);
                if (pooled) {
                    pooled.client.end();
                    this.pool.delete(key);
                    console.log(`[SSH Pool] Removed stale connection: ${key}`);
                }
            }

            if (staleKeys.length > 0) {
                console.log(`[SSH Pool] Cleaned up ${staleKeys.length} stale connection(s)`);
            }
        }, 60000); // Check every minute
    }

    /**
     * Close all connections and stop cleanup
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        for (const [key, pooled] of this.pool.entries()) {
            pooled.client.end();
        }

        this.pool.clear();
        console.log('[SSH Pool] Destroyed all connections');
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            activeConnections: this.pool.size,
            connections: Array.from(this.pool.entries()).map(([key, pooled]) => ({
                key,
                host: pooled.credentials.host,
                port: pooled.credentials.port,
                lastUsed: new Date(pooled.lastUsed).toISOString(),
                isConnecting: pooled.isConnecting,
            })),
        };
    }
}

// Singleton instance
let poolInstance: SSHConnectionPool | null = null;

export function getSSHPool(): SSHConnectionPool {
    if (!poolInstance) {
        poolInstance = new SSHConnectionPool();
    }
    return poolInstance;
}

// Graceful shutdown
if (typeof process !== 'undefined') {
    process.on('SIGTERM', () => {
        if (poolInstance) {
            poolInstance.destroy();
        }
    });

    process.on('SIGINT', () => {
        if (poolInstance) {
            poolInstance.destroy();
        }
    });
}
