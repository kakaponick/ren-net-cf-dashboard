import fetch from 'node-fetch';
import { NjallaDomain } from '@/types/njalla';

interface NjallaConfig {
  apiKey: string;
}

interface NjallaRequest {
  method: string;
  params: Record<string, unknown>;
}

interface NjallaResponse<T> {
  result: T;
  jsonrpc: '2.0';
  id?: string | number | null;
}

interface NjallaDomainInfo {
  name: string;
  status: string;
  expiry: string;
  autorenew: boolean;
  nameservers?: string[];
}

interface NjallaListDomainsResult {
  domains: NjallaDomainInfo[];
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

  private async makeRequest<T>(request: NjallaRequest): Promise<NjallaResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Njalla ${this.config.apiKey}`,
    };

    const payload = {
      ...request,
      id: Date.now().toString(),
      jsonrpc: '2.0' as const
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as NjallaErrorResponse | { error?: { message?: string } };
      const errorMessage = errorData.error?.message || `API request failed: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json() as NjallaResponse<T> | NjallaErrorResponse;

    // Check for JSONRPC error response
    if ('error' in data && data.error) {
      console.error('Njalla API Error Response:', JSON.stringify(data, null, 2));

      let errorMessage: string;
      if (typeof data.error === 'string') {
        errorMessage = data.error;
      } else if (data.error.message) {
        errorMessage = data.error.message;
      } else {
        errorMessage = `JSONRPC API error (Code: ${data.error.code}): ${JSON.stringify(data.error)}`;
      }

      throw new Error(errorMessage);
    }

    return data as NjallaResponse<T>;
  }

  async getDomains(): Promise<NjallaDomain[]> {
    try {
      const response = await this.makeRequest<NjallaListDomainsResult>({
        method: 'list-domains',
        params: {},
      });

      if (!response.result?.domains || !Array.isArray(response.result.domains)) {
        return [];
      }

      return response.result.domains.map((d) => ({
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

  async editDomain(domain: string, params: {
    nameservers?: string[];
    mailforwarding?: boolean;
    dnssec?: boolean;
    lock?: boolean;
    contacts?: any; // Define usage if known
  }): Promise<void> {
    try {
      await this.makeRequest<void>({
        method: 'edit-domain',
        params: {
          domain,
          ...params
        }
      });
    } catch (error) {
      console.error(`Error editing Njalla domain ${domain}:`, error);
      throw error;
    }
  }

  async getDomain(domain: string): Promise<NjallaDomainInfo> {
    try {
      const response = await this.makeRequest<NjallaDomainInfo>({
        method: 'get-domain',
        params: { domain }
      });
      return response.result;
    } catch (error) {
      console.error(`Error getting Njalla domain ${domain}:`, error);
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
