import { NextRequest, NextResponse } from 'next/server';
import { DynadotAPI } from '@/lib/dynadot-api';
import type { DynadotAccount, DynadotDomainsResponse } from '@/types/dynadot';

function createErrorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const accountId = request.headers.get('x-account-id');
    const accountEmail = request.headers.get('x-account-email') ?? '';

    if (!apiKey) {
      return createErrorResponse('Missing required header: x-api-key');
    }

    if (!accountId) {
      return createErrorResponse('Missing required header: x-account-id');
    }

    const api = new DynadotAPI({ apiKey });
    const domains = await api.getDomains();

    const account: DynadotAccount = {
      id: accountId,
      name: request.headers.get('x-account-name') ?? `Dynadot Account (${accountEmail || accountId})`,
      email: accountEmail,
      apiKey,
      createdAt: new Date(),
    };

    const result: DynadotDomainsResponse = { domains, account };
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(message, 500);
  }
}
