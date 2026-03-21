import { NextRequest, NextResponse } from 'next/server';
import { generateUniqueSlug } from '@/lib/slug-generator';
import {
    authenticateWithNPM,
    buildRedirectUpdatePayload,
    extractLocationPaths,
    NPMServerError,
    normalizeNPMHost,
    requestNPM,
} from '@/lib/npm-server';
import type { NPMRedirectListResponse } from '@/types/npm';

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 200;

function appendLines(config: string | undefined, lines: string[]): string {
    const trimmed = config?.trim() || '';
    if (!trimmed) {
        return lines.join('\n');
    }

    return `${trimmed}\n${lines.join('\n')}`;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const host = typeof body?.host === 'string' ? normalizeNPMHost(body.host) : '';
        const identity = typeof body?.identity === 'string' ? body.identity.trim() : '';
        const secret = typeof body?.secret === 'string' ? body.secret : '';
        const domain = typeof body?.domain === 'string' ? body.domain.trim() : '';
        const urls = Array.isArray(body?.urls)
            ? body.urls.filter((url: unknown): url is string => typeof url === 'string')
            : [];
        const requestedBatchSize = Number(body?.batchSize);
        const batchSize = Number.isFinite(requestedBatchSize)
            ? Math.min(Math.max(Math.floor(requestedBatchSize), 1), MAX_BATCH_SIZE)
            : DEFAULT_BATCH_SIZE;

        if (!host || !identity || !secret || !domain || urls.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields: host, identity, secret, domain, urls' },
                { status: 400 }
            );
        }

        for (const url of urls) {
            try {
                new URL(url);
            } catch {
                return NextResponse.json(
                    { error: `Invalid URL: ${url}` },
                    { status: 400 }
                );
            }
        }

        const auth = await authenticateWithNPM({ host, identity, secret });
        const redirects = await requestNPM<NPMRedirectListResponse[]>(
            host,
            auth.token,
            '/api/nginx/redirection-hosts',
            { method: 'GET' }
        );

        const redirect = redirects.find((item) => item.domain_names.includes(domain));
        if (!redirect) {
            return NextResponse.json(
                { error: `No redirect host found for domain ${domain}` },
                { status: 404 }
            );
        }

        const reservedLocations = new Set(extractLocationPaths(redirect.advanced_config));
        const createdUrls: string[] = [];
        const newLines: string[] = [];

        for (const url of urls) {
            const slug = generateUniqueSlug(Array.from(reservedLocations));
            const location = `/${slug}`;
            reservedLocations.add(location);
            newLines.push(`location = ${location} { return 301 ${url}; }`);
            createdUrls.push(`https://${domain}/${slug}`);
        }

        let currentRedirect = redirect;
        let batches = 0;

        for (let index = 0; index < newLines.length; index += batchSize) {
            const chunk = newLines.slice(index, index + batchSize);
            const advancedConfig = appendLines(currentRedirect.advanced_config, chunk);

            currentRedirect = await requestNPM<NPMRedirectListResponse>(
                host,
                auth.token,
                `/api/nginx/redirection-hosts/${redirect.id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(buildRedirectUpdatePayload(currentRedirect, advancedConfig)),
                    timeoutMs: 45000,
                    retries: 3,
                }
            );

            batches += 1;
        }

        return NextResponse.json({
            createdCount: createdUrls.length,
            createdUrls,
            batches,
            redirectId: redirect.id,
        });
    } catch (error) {
        console.error('NPM bulk redirects error:', error);

        if (error instanceof NPMServerError) {
            return NextResponse.json(
                {
                    error: error.message,
                    nginxError: error.nginxError,
                },
                { status: error.status >= 400 ? error.status : 500 }
            );
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
