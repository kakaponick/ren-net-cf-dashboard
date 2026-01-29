import { SocksProxyAgent } from 'socks-proxy-agent';
import { parseStringPromise } from 'xml2js';
import fetch from 'node-fetch';
import { NamecheapApiResponse, NamecheapDomain, NamecheapDomainsResponse } from '@/types/namecheap';

interface NamecheapConfig {
  apiUser: string;
  apiKey: string;
  clientIp: string;
  proxy?: {
    host: string;
    port: string;
    username?: string;
    password?: string;
  };
}

export class NamecheapAPI {
  private config: NamecheapConfig;
  private readonly baseUrl = 'https://api.namecheap.com/xml.response';

  constructor(config: NamecheapConfig) {
    this.config = config;
  }

  private createProxyAgent(): SocksProxyAgent | undefined {
    if (!this.config.proxy) return undefined;

    const { host, port, username, password } = this.config.proxy;
    const proxyUrl = new URL(`socks5://${host}:${port}`);
    if (username) proxyUrl.username = username;
    if (password) proxyUrl.password = password;

    return new SocksProxyAgent(proxyUrl.toString());
  }

  private buildUrl(command: string, params: Record<string, string> = {}): string {
    const queryParams = new URLSearchParams({
      ApiUser: this.config.apiUser,
      UserName: this.config.apiUser,
      ApiKey: this.config.apiKey,
      ClientIp: this.config.clientIp,
      Command: command,
      ...params,
    });
    return `${this.baseUrl}?${queryParams.toString()}`;
  }

  private parseBoolean(value: any): boolean {
    return String(value).toLowerCase() === 'true';
  }

  private async parseXmlResponse(xmlData: string): Promise<any> {
    return parseStringPromise(xmlData, {
      explicitArray: false,
      ignoreAttrs: false,
    });
  }

  private handleApiError(apiResponse: any): never {
    if (process.env.NODE_ENV === 'development') {
      console.error('Namecheap API Error Response:', JSON.stringify(apiResponse, null, 2));
    }

    const errorData = apiResponse.Errors?.Error;
    const firstError = Array.isArray(errorData) ? errorData[0] : errorData;
    const errorMessage = firstError?._ || (typeof firstError === 'string' ? firstError : 'Unknown error from Namecheap API');

    let userFriendlyMessage = errorMessage;
    if (errorMessage.includes('IP') || errorMessage.includes('ClientIp')) {
      userFriendlyMessage = `Proxy IP not whitelisted. Please add ${this.config.clientIp} to your Namecheap API whitelist.`;
    } else if (errorMessage.includes('ApiKey') || errorMessage.includes('authentication')) {
      userFriendlyMessage = 'Invalid API credentials. Please check your Namecheap API key and username.';
    }

    throw new Error(userFriendlyMessage);
  }

  async getDomains(page: number = 1, pageSize: number = 100): Promise<{ domains: NamecheapDomain[], paging: any }> {
    const url = this.buildUrl('namecheap.domains.getList', {
      PageSize: String(pageSize),
      Page: String(page),
    });

    const proxyAgent = this.createProxyAgent();

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/xml' },
        ...(proxyAgent && { agent: proxyAgent as any }),
      });
    } catch (error) {
      throw new Error(`Failed to connect to Namecheap API: ${error instanceof Error ? error.message : 'Unknown network error'}`);
    }

    if (!response.ok) {
      throw new Error(`Namecheap API HTTP error: ${response.status}`);
    }

    const xmlText = await response.text();
    const parsedData = await this.parseXmlResponse(xmlText);
    const { ApiResponse } = parsedData;

    if (ApiResponse.$.Status !== 'OK') {
      this.handleApiError(ApiResponse);
    }

    const commandResponse = Array.isArray(ApiResponse.CommandResponse)
      ? ApiResponse.CommandResponse[0]
      : ApiResponse.CommandResponse;

    if (!commandResponse) {
      throw new Error('No command response found in Namecheap API response');
    }

    // Handle DomainGetListResult - can be array or single object
    const domainGetListResult = Array.isArray(commandResponse.DomainGetListResult)
      ? commandResponse.DomainGetListResult[0]
      : commandResponse.DomainGetListResult;

    if (!domainGetListResult) {
      // If no result, it might mean no domains found or empty list. 
      // Namecheap sometimes returns empty DomainGetListResult if no domains.
      return {
        domains: [],
        paging: { totalItems: 0, currentPage: page, pageSize }
      };
    }

    // Handle Paging - can be array or single object
    const paging = commandResponse.Paging
      ? (Array.isArray(commandResponse.Paging) ? commandResponse.Paging[0] : commandResponse.Paging)
      : undefined;

    const rawDomains = Array.isArray(domainGetListResult.Domain)
      ? domainGetListResult.Domain
      : (domainGetListResult.Domain?.$ ? [domainGetListResult.Domain] : []);

    const domains = rawDomains.map((d: any) => {
      const domain = d.$ || d;
      return {
        ...domain,
        ID: parseInt(domain.ID, 10),
        IsExpired: this.parseBoolean(domain.IsExpired),
        IsLocked: this.parseBoolean(domain.IsLocked),
        AutoRenew: this.parseBoolean(domain.AutoRenew),
        IsPremium: this.parseBoolean(domain.IsPremium),
        IsOurDNS: this.parseBoolean(domain.IsOurDNS),
      };
    });

    const pagingInfo = paging ? {
      totalItems: parseInt(paging.TotalItems?.[0] || '0'),
      currentPage: parseInt(paging.CurrentPage?.[0] || '1'),
      pageSize: parseInt(paging.PageSize?.[0] || '10'),
    } : {
      totalItems: domains.length,
      currentPage: 1,
      pageSize: domains.length,
    };


    return { domains, paging: pagingInfo };
  }

  async getNameservers(sld: string, tld: string): Promise<{ nameservers: string[], isUsingOurDNS: boolean }> {
    const url = this.buildUrl('namecheap.domains.dns.getList', {
      SLD: sld,
      TLD: tld,
    });

    const proxyAgent = this.createProxyAgent();

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/xml' },
        ...(proxyAgent && { agent: proxyAgent as any }),
      });
    } catch (error) {
      throw new Error(`Failed to connect to Namecheap API: ${error instanceof Error ? error.message : 'Unknown network error'}`);
    }

    if (!response.ok) {
      throw new Error(`Namecheap API HTTP error: ${response.status}`);
    }

    const xmlText = await response.text();
    const parsedData = await this.parseXmlResponse(xmlText);
    const { ApiResponse } = parsedData;

    if (ApiResponse.$.Status !== 'OK') {
      this.handleApiError(ApiResponse);
    }

    const commandResponse = Array.isArray(ApiResponse.CommandResponse)
      ? ApiResponse.CommandResponse[0]
      : ApiResponse.CommandResponse;

    if (!commandResponse) {
      throw new Error('No command response found in Namecheap API response');
    }

    const dnsGetListResult = Array.isArray(commandResponse.DomainDNSGetListResult)
      ? commandResponse.DomainDNSGetListResult[0]
      : commandResponse.DomainDNSGetListResult;

    if (!dnsGetListResult) {
      throw new Error('No DNS list result found in response');
    }

    // Check if using Namecheap DNS
    const isUsingOurDNS = this.parseBoolean(dnsGetListResult.$.IsUsingOurDNS);

    // Extract nameservers
    let nameservers: string[] = [];
    if (dnsGetListResult.Nameserver) {
      const nsData = Array.isArray(dnsGetListResult.Nameserver)
        ? dnsGetListResult.Nameserver
        : [dnsGetListResult.Nameserver];
      nameservers = nsData.map((ns: any) => typeof ns === 'string' ? ns : ns._);
    }

    return { nameservers, isUsingOurDNS };
  }

  async setNameservers(sld: string, tld: string, nameservers: string[]): Promise<{ success: boolean }> {
    // Namecheap expects comma-separated nameservers
    const nameserversParam = nameservers.join(',');

    const url = this.buildUrl('namecheap.domains.dns.setCustom', {
      SLD: sld,
      TLD: tld,
      Nameservers: nameserversParam,
    });

    const proxyAgent = this.createProxyAgent();

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        ...(proxyAgent && { agent: proxyAgent as any }),
      });
    } catch (error) {
      throw new Error(`Failed to connect to Namecheap API: ${error instanceof Error ? error.message : 'Unknown network error'}`);
    }

    if (!response.ok) {
      throw new Error(`Namecheap API HTTP error: ${response.status}`);
    }

    const xmlText = await response.text();
    const parsedData = await this.parseXmlResponse(xmlText);
    const { ApiResponse } = parsedData;

    if (ApiResponse.$.Status !== 'OK') {
      this.handleApiError(ApiResponse);
    }

    const commandResponse = Array.isArray(ApiResponse.CommandResponse)
      ? ApiResponse.CommandResponse[0]
      : ApiResponse.CommandResponse;

    if (!commandResponse) {
      throw new Error('No command response found in Namecheap API response');
    }

    const dnsSetCustomResult = Array.isArray(commandResponse.DomainDNSSetCustomResult)
      ? commandResponse.DomainDNSSetCustomResult[0]
      : commandResponse.DomainDNSSetCustomResult;

    if (!dnsSetCustomResult) {
      throw new Error('No DNS set custom result found in response');
    }

    // Check if update was successful
    const updated = this.parseBoolean(dnsSetCustomResult.$.Updated);

    return { success: updated };
  }
}

