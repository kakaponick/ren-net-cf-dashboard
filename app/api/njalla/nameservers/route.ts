
import { NextRequest, NextResponse } from 'next/server';
import { NjallaAPI } from '@/lib/njalla-api';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const domain = searchParams.get('domain');
        const apiKey = req.headers.get('x-api-key');

        if (!domain) {
            return NextResponse.json({ success: false, error: 'Domain is required' }, { status: 400 });
        }

        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
        }

        const api = new NjallaAPI({ apiKey });
        const domainInfo = await api.getDomain(domain);

        // Njalla returns nameservers as part of domain info?
        // Based on user request "nameservers: list of custom nameservers or empty list to use our nameservers"
        // We assume get-domain returns current nameservers.

        return NextResponse.json({
            success: true,
            data: {
                nameservers: domainInfo.nameservers || [],
                // If nameservers list is empty, it uses Njalla nameservers (default)
                isUsingOurDNS: !domainInfo.nameservers || domainInfo.nameservers.length === 0
            }
        });

    } catch (error) {
        console.error('Error fetching Njalla nameservers:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { domain, nameservers } = body;
        const apiKey = req.headers.get('x-api-key');

        if (!domain) {
            return NextResponse.json({ success: false, error: 'Domain is required' }, { status: 400 });
        }

        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
        }

        if (!Array.isArray(nameservers)) {
            return NextResponse.json({ success: false, error: 'Nameservers must be an array' }, { status: 400 });
        }

        const api = new NjallaAPI({ apiKey });

        // Call edit-domain with new nameservers
        // If nameservers is empty array, it resets to default (according to user specs)
        await api.editDomain(domain, { nameservers });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error setting Njalla nameservers:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
