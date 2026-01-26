import { NextRequest, NextResponse } from 'next/server';
import { NjallaAPI } from '@/lib/njalla-api';
import type { NjallaDomain } from '@/types/njalla';

interface NjallaDomainResponse {
  domains: NjallaDomain[];
}

function createErrorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-njalla-key');
    const accountId = request.headers.get('x-account-id');

    if (!apiKey) {
      return createErrorResponse('Missing required header: x-njalla-key');
    }

    if (!accountId) {
      return createErrorResponse('Missing required header: x-account-id');
    }

    // Parse the request body to get the JSONRPC request
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON in request body');
    }

    // Validate JSONRPC structure
    if (!body.method || body.method !== 'list-domains') {
      return createErrorResponse('Invalid method. Only list-domains is supported');
    }

    // Initialize Njalla API service
    const api = new NjallaAPI({ apiKey, accountId });

    try {
      const domains = await api.getDomains();

      const result: NjallaDomainResponse = {
        domains: domains.map(d => ({
          name: d.name,
          status: d.status,
          expiry: d.expiry,
          autorenew: d.autorenew,
        })),
      };

      return NextResponse.json({ 
        success: true, 
        result: { domains: result.domains },
        jsonrpc: '2.0'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createErrorResponse(errorMessage);
    }

  } catch (error) {
    console.error('Unhandled error in Njalla domains route:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
