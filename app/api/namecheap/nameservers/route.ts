import { NextRequest, NextResponse } from 'next/server';
import { NamecheapAPI } from '@/lib/namecheap-api';

const REQUIRED_HEADERS = ['x-account-id', 'x-api-user', 'x-api-key', 'x-proxy-host'] as const;

interface RouteHeaders {
    accountId: string;
    apiUser: string;
    apiKey: string;
    proxyHost: string;
    proxyPort?: string | null;
    proxyUsername?: string | null;
    proxyPassword?: string | null;
}

function extractHeaders(request: NextRequest): RouteHeaders | null {
    const accountId = request.headers.get('x-account-id');
    const apiUser = request.headers.get('x-api-user');
    const apiKey = request.headers.get('x-api-key');
    const proxyHost = request.headers.get('x-proxy-host');

    if (!accountId || !apiUser || !apiKey || !proxyHost) {
        return null;
    }

    return {
        accountId,
        apiUser,
        apiKey,
        proxyHost,
        proxyPort: request.headers.get('x-proxy-port'),
        proxyUsername: request.headers.get('x-proxy-username'),
        proxyPassword: request.headers.get('x-proxy-password'),
    };
}

function createErrorResponse(message: string, status: number = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
}

function createNamecheapAPI(headers: RouteHeaders): NamecheapAPI {
    const { apiUser, apiKey, proxyHost, proxyPort, proxyUsername, proxyPassword } = headers;

    return new NamecheapAPI({
        apiUser,
        apiKey,
        clientIp: proxyHost,
        proxy: proxyHost && proxyPort ? {
            host: proxyHost,
            port: proxyPort,
            username: proxyUsername || undefined,
            password: proxyPassword || undefined,
        } : undefined,
    });
}

// GET /api/namecheap/nameservers?sld=example&tld=com
export async function GET(request: NextRequest) {
    try {
        const headers = extractHeaders(request);
        if (!headers) {
            return createErrorResponse(
                `Missing required headers: ${REQUIRED_HEADERS.join(', ')}`
            );
        }

        // Extract query parameters
        const searchParams = request.nextUrl.searchParams;
        const sld = searchParams.get('sld');
        const tld = searchParams.get('tld');

        if (!sld || !tld) {
            return createErrorResponse('Missing required query parameters: sld, tld');
        }

        const api = createNamecheapAPI(headers);

        try {
            const result = await api.getNameservers(sld, tld);
            return NextResponse.json({
                success: true,
                data: result
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return createErrorResponse(errorMessage);
        }

    } catch (error) {
        console.error('Unhandled error in Namecheap nameservers GET route:', error);
        return createErrorResponse('Internal server error', 500);
    }
}

// POST /api/namecheap/nameservers
// Body: { sld: string, tld: string, nameservers: string[] }
export async function POST(request: NextRequest) {
    try {
        const headers = extractHeaders(request);
        if (!headers) {
            return createErrorResponse(
                `Missing required headers: ${REQUIRED_HEADERS.join(', ')}`
            );
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch {
            return createErrorResponse('Invalid JSON body');
        }

        const { sld, tld, nameservers } = body;

        if (!sld || !tld || !nameservers || !Array.isArray(nameservers)) {
            return createErrorResponse('Missing or invalid required fields: sld, tld, nameservers (array)');
        }

        if (nameservers.length === 0) {
            return createErrorResponse('At least one nameserver is required');
        }

        // Validate nameservers (basic validation)
        for (const ns of nameservers) {
            if (typeof ns !== 'string' || ns.trim().length === 0) {
                return createErrorResponse('All nameservers must be non-empty strings');
            }
        }

        const api = createNamecheapAPI(headers);

        try {
            const result = await api.setNameservers(sld, tld, nameservers);
            return NextResponse.json({
                success: true,
                data: result
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return createErrorResponse(errorMessage);
        }

    } catch (error) {
        console.error('Unhandled error in Namecheap nameservers POST route:', error);
        return createErrorResponse('Internal server error', 500);
    }
}
