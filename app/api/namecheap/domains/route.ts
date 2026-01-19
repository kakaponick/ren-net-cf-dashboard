import { NextRequest, NextResponse } from 'next/server';
import { NamecheapAPI } from '@/lib/namecheap-api';
import type { NamecheapDomainsResponse, NamecheapAccount } from '@/types/namecheap';

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

export async function GET(request: NextRequest) {
  try {
    const headers = extractHeaders(request);
    if (!headers) {
      return createErrorResponse(
        `Missing required headers: ${REQUIRED_HEADERS.join(', ')}`
      );
    }

    const { accountId, apiUser, apiKey, proxyHost, proxyPort, proxyUsername, proxyPassword } = headers;

    // Initialize Namecheap API service
    // Note: The proxy host is used as the ClientIp because all requests go through it
    const api = new NamecheapAPI({
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

    try {
      const { domains, paging } = await api.getDomains();

      // Construct the account object expected by the frontend
      // In a real app, we might fetch this from a database instead of constructing it from headers
      const account: NamecheapAccount = {
        id: accountId,
        name: `Namecheap Account (${apiUser})`,
        email: '', 
        apiUser,
        apiKey,
        createdAt: new Date(),
      };

      const result: NamecheapDomainsResponse = {
        domains,
        paging,
        account,
      };

      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createErrorResponse(errorMessage);
    }

  } catch (error) {
    console.error('Unhandled error in Namecheap domains route:', error);
    return createErrorResponse('Internal server error', 500);
  }
}