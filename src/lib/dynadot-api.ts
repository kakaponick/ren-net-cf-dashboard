import fetch from 'node-fetch';
import type { DynadotDomain } from '@/types/dynadot';
import {
  extractDynadotHosts,
  isDynadotUsingOurDNS,
} from '@/lib/dynadot-utils';

interface DynadotConfig {
  apiKey: string;
}

interface DynadotResponseEnvelope {
  ResponseCode?: number | string;
  Status?: string;
  Error?: string | { content?: string } | Array<{ content?: string }>;
}

interface DynadotListDomainResponse {
  ListDomainInfoResponse?: DynadotResponseEnvelope & {
    MainDomains?: DynadotDomain[] | DynadotDomain;
  };
}

interface DynadotGetNsResponse {
  GetNsResponse?: DynadotResponseEnvelope & {
    NsContent?: Record<string, unknown>;
  };
}

interface DynadotSetNsResponse {
  SetNsResponse?: DynadotResponseEnvelope;
}

export class DynadotAPI {
  private readonly baseUrl = 'https://api.dynadot.com/api3.json';

  constructor(private readonly config: DynadotConfig) {}

  private buildUrl(params: Record<string, string>): string {
    const query = new URLSearchParams({
      key: this.config.apiKey,
      ...params,
    });

    return `${this.baseUrl}?${query.toString()}`;
  }

  private async request<T>(params: Record<string, string>): Promise<T> {
    const response = await fetch(this.buildUrl(params), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Dynadot API HTTP error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private assertSuccess(envelope: DynadotResponseEnvelope | undefined, fallbackMessage: string) {
    if (!envelope) {
      throw new Error(fallbackMessage);
    }

    const status = String(envelope.Status ?? '').toLowerCase();
    const responseCode = String(envelope.ResponseCode ?? '');
    if (status === 'success' || responseCode === '0') {
      return;
    }

    const error = envelope.Error;
    if (typeof error === 'string' && error.trim()) {
      throw new Error(error);
    }
    if (Array.isArray(error) && error[0]?.content) {
      throw new Error(error[0].content);
    }
    if (!Array.isArray(error) && typeof error === 'object' && error?.content) {
      throw new Error(error.content);
    }

    throw new Error(fallbackMessage);
  }

  async getDomains(): Promise<DynadotDomain[]> {
    const payload = await this.request<DynadotListDomainResponse>({
      command: 'list_domain',
    });

    const envelope = payload.ListDomainInfoResponse;
    this.assertSuccess(envelope, 'Failed to load Dynadot domains');

    const domains = envelope?.MainDomains;
    const list = Array.isArray(domains) ? domains : domains ? [domains] : [];

    return list.map((domain) => ({
      ...domain,
      registrar: 'dynadot',
      isUsingOurDNS: isDynadotUsingOurDNS(domain.NameServerSettings),
    }));
  }

  async getNameservers(domain: string): Promise<{ nameservers: string[]; isUsingOurDNS: boolean }> {
    const payload = await this.request<DynadotGetNsResponse>({
      command: 'get_ns',
      domain,
    });

    const envelope = payload.GetNsResponse;
    this.assertSuccess(envelope, `Failed to load nameservers for ${domain}`);

    const nameservers = extractDynadotHosts(envelope?.NsContent);
    return {
      nameservers,
      isUsingOurDNS: nameservers.length === 0,
    };
  }

  async setNameservers(domain: string, nameservers: string[]): Promise<{ success: boolean }> {
    const params: Record<string, string> = {
      command: 'set_ns',
      domain,
    };

    nameservers.forEach((nameserver, index) => {
      params[`ns${index}`] = nameserver;
    });

    const payload = await this.request<DynadotSetNsResponse>(params);
    this.assertSuccess(payload.SetNsResponse, `Failed to update nameservers for ${domain}`);

    return { success: true };
  }
}
