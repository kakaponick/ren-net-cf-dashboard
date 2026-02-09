import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    return handleProxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
    return handleProxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
    return handleProxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
    return handleProxyRequest(request, 'DELETE');
}

async function handleProxyRequest(request: NextRequest, method: string) {
    try {
        const host = request.headers.get('X-NPM-Host');
        const token = request.headers.get('X-NPM-Token');
        const endpoint = request.headers.get('X-NPM-Endpoint');

        if (!host || !token || !endpoint) {
            return NextResponse.json(
                { error: 'Missing required headers: X-NPM-Host, X-NPM-Token, X-NPM-Endpoint' },
                { status: 400 }
            );
        }

        // Build NPM URL
        const npmUrl = `${host}${endpoint}`;

        // Prepare request options
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        };

        // Add body for POST/PUT requests
        if (method === 'POST' || method === 'PUT') {
            const body = await request.text();
            if (body) {
                options.body = body;
            }
        }

        // Forward request to NPM
        const response = await fetch(npmUrl, options);

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `NPM API error: ${errorText}` },
                { status: response.status }
            );
        }

        // For DELETE, return success without parsing JSON
        if (method === 'DELETE') {
            return NextResponse.json({ success: true });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('NPM proxy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
