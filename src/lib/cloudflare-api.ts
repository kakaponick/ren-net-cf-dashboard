
/**
 * Generic pagination helper for Cloudflare API endpoints
 * @param makeRequest Function to make API requests
 * @param endpoint The API endpoint to paginate
 * @param perPage Number of items per page (max 100 for most endpoints)
 * @returns Promise resolving to all items from all pages
 */

export async function paginateCloudflareAPI(
  makeRequest: (url: string) => Promise<any>,
  endpoint: string,
  perPage: number = 50
): Promise<any[]> {
  const allItems: any[] = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const url = `${endpoint}?page=${page}&per_page=${perPage}`;
    const response = await makeRequest(url);
    const items = response.result || [];
    
    if (items.length === 0) {
      hasMorePages = false;
    } else {
      allItems.push(...items);
      
      // Check if we have more pages
      const resultInfo = response.result_info;
      if (resultInfo && resultInfo.page < resultInfo.total_pages) {
        page++;
      } else {
        hasMorePages = false;
      }
    }
  }

  return allItems;
}

export class CloudflareAPI {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async makeRequest(endpoint: string, options: any = {}) {
    const fetchOptions: RequestInit = {
      method: options.method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    // Stringify body if it exists
    if (options.body) {
      fetchOptions.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }

    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : window.location.origin
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/cloudflare${endpoint}`, fetchOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  // Account management
  async getAccounts() {
    try {
      const response = await this.makeRequest('/accounts');
      return response.result || [];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw new Error('Failed to fetch accounts');
    }
  }

  // Zone/Domain management
  async getZones() {
    try {
      return await paginateCloudflareAPI(
        (url) => this.makeRequest(url),
        '/zones',
        50
      );
    } catch (error) {
      console.error('Error fetching zones:', error);
      throw new Error('Failed to fetch zones');
    }
  }

  async getZone(zoneId: string) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}`);
      return response.result;
    } catch (error) {
      console.error('Error fetching zone:', error);
      throw new Error('Failed to fetch zone');
    }
  }

  async createZone(domainName: string, accountId?: string) {
    try {
      // If no accountId provided, fetch the first account from Cloudflare API
      let cfAccountId = accountId;
      if (!cfAccountId) {
        const accounts = await this.getAccounts();
        if (accounts.length === 0) {
          throw new Error('No Cloudflare accounts found for this API token');
        }
        cfAccountId = accounts[0].id;
      }

      const response = await this.makeRequest('/zones', {
        method: 'POST',
        body: {
          name: domainName,
          account: { id: cfAccountId },
          jump_start: false,
        },
      });
      return response.result;
    } catch (error) {
      console.error('Error creating zone:', error);
      throw error;
    }
  }

  // DNS Records management
  async getDNSRecords(zoneId: string) {
    try {
      return await paginateCloudflareAPI(
        (url) => this.makeRequest(url),
        `/zones/${zoneId}/dns_records`,
        100
      );
    } catch (error) {
      console.error('Error fetching DNS records:', error);
      throw new Error('Failed to fetch DNS records');
    }
  }

  async createDNSRecord(zoneId: string, record: any) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: {
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl || 1,
          proxied: record.proxied || false,
          comment: record.comment,
        },
      });
      return response.result;
    } catch (error) {
      console.error('Error creating DNS record:', error);
      throw new Error('Failed to create DNS record');
    }
  }

  async updateDNSRecord(zoneId: string, recordId: string, record: any) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'PATCH',
        body: {
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl || 1,
          proxied: record.proxied || false,
          comment: record.comment,
        },
      });
      return response.result;
    } catch (error) {
      console.error('Error updating DNS record:', error);
      throw new Error('Failed to update DNS record');
    }
  }

  async deleteDNSRecord(zoneId: string, recordId: string) {
    try {
      await this.makeRequest(`/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting DNS record:', error);
      throw new Error('Failed to delete DNS record');
    }
  }

  // SSL Certificate management
  async getSSLCertificates(zoneId: string) {
    try {
      return await paginateCloudflareAPI(
        (url) => this.makeRequest(url),
        `/zones/${zoneId}/ssl/certificate_packs`,
        100
      );
    } catch (error) {
      console.error('Error fetching SSL certificates:', error);
      throw new Error('Failed to fetch SSL certificates');
    }
  }

  async getSSLSetting(zoneId: string) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/settings/ssl`);
      return response.result;
    } catch (error) {
      console.error('Error fetching SSL setting:', error);
      throw new Error('Failed to fetch SSL setting');
    }
  }

  async updateSSLSetting(zoneId: string, value: string) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/settings/ssl`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      });
      return response.result;
    } catch (error) {
      console.error('Error updating SSL setting:', error);
      throw new Error('Failed to update SSL setting');
    }
  }

  // Test API connection
  async testConnection() {
    try {
      await this.makeRequest('/user');
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }
}