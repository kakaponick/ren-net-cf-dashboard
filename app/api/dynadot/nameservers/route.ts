import { NextRequest, NextResponse } from 'next/server';
import { DynadotAPI } from '@/lib/dynadot-api';

function createErrorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function getAPI(request: NextRequest): DynadotAPI | null {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) return null;
  return new DynadotAPI({ apiKey });
}

export async function GET(request: NextRequest) {
  try {
    const api = getAPI(request);
    if (!api) {
      return createErrorResponse('Missing required header: x-api-key');
    }

    const domain = request.nextUrl.searchParams.get('domain');
    if (!domain) {
      return createErrorResponse('Missing required query parameter: domain');
    }

    const result = await api.getNameservers(domain);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const api = getAPI(request);
    if (!api) {
      return createErrorResponse('Missing required header: x-api-key');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body');
    }

    const domain = typeof (body as { domain?: unknown })?.domain === 'string'
      ? (body as { domain: string }).domain
      : '';
    const nameservers = Array.isArray((body as { nameservers?: unknown })?.nameservers)
      ? (body as { nameservers: unknown[] }).nameservers
      : null;

    if (!domain || !nameservers) {
      return createErrorResponse('Missing or invalid required fields: domain, nameservers (array)');
    }

    const cleanedNameservers = nameservers
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);

    if (cleanedNameservers.length === 0) {
      return createErrorResponse('At least one nameserver is required');
    }

    const result = await api.setNameservers(domain, cleanedNameservers);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(message, 500);
  }
}
