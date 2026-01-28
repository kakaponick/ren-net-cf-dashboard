import { NextResponse } from 'next/server';
import { getSSHPool } from '../server-stats/ssh-pool';

/**
 * GET /api/ssh-pool-stats
 * Returns statistics about the SSH connection pool
 */
export async function GET() {
    try {
        const pool = getSSHPool();
        const stats = pool.getStats();

        return NextResponse.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting pool stats:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get pool statistics' },
            { status: 500 }
        );
    }
}
