import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { host, identity, secret } = body;

        if (!host || !identity || !secret) {
            return NextResponse.json(
                { error: 'Missing required fields: host, identity, secret' },
                { status: 400 }
            );
        }

        // Forward authentication request to NPM
        const npmUrl = `${host}/api/tokens`;
        const response = await fetch(npmUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                identity,
                secret,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `NPM authentication failed: ${errorText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('NPM auth error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
