import fetch from 'node-fetch';
import { NjallaDomain } from '@/types/njalla';

interface NjallaConfig {
  apiKey: string;
}

interface NjallaListDomainsRequest {
  method: 'list-domains';
  params: Record<string, unknown>;
}

interface NjallaListDomainsResponse {
  result: {
    domains: Array<{
      name: string;
      status: string;
      expiry: string;
      autorenew: boolean;
    }>;
  };
  jsonrpc: '2.0';
}

interface NjallaErrorResponse {
  error: {
    code: number;
    message: string;
  };
  jsonrpc: '2.0';
}

export class NjallaAPI {
  private config: NjallaConfig & { accountId?: string };
  private readonly baseUrl = 'https://njal.la/api/1/';

  constructor(config: NjallaConfig & { accountId?: string }) {
    this.config = config;
  }

  private async makeRequest(request: NjallaListDomainsRequest): Promise<NjallaListDomainsResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Njalla ${this.config.apiKey}`,
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as NjallaErrorResponse | { error?: { message?: string } };
      const errorMessage = errorData.error?.message || `API request failed: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json() as NjallaListDomainsResponse | NjallaErrorResponse;

    // Check for JSONRPC error response
    if ('error' in data && data.error) {
      throw new Error(data.error.message || 'JSONRPC API error');
    }

    return data as NjallaListDomainsResponse;
  }

  async getDomains(): Promise<NjallaDomain[]> {
    try {
      const response = await this.makeRequest({
        method: 'list-domains',
        params: {},
      });

      if (!response.result?.domains || !Array.isArray(response.result.domains)) {
        return [];
      }

      return response.result.domains.map((d: any) => ({
        name: d.name,
        status: d.status,
        expiry: d.expiry,
        autorenew: d.autorenew,
      }));
    } catch (error) {
      console.error('Error fetching Njalla domains:', error);
      throw error;
    }
  }

  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      await this.getDomains();
      return true;
    } catch (error) {
      console.error('Njalla API connection test failed:', error);
      return false;
    }
  }
}
