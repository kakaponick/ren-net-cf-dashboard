
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

  // Ensure perPage is within valid range (1-100)
  const validPerPage = Math.max(1, Math.min(100, perPage));

  while (hasMorePages) {
    // Build URL with proper query parameter handling
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}page=${page}&per_page=${validPerPage}`;

    try {
      const response = await makeRequest(url);

      // Validate response structure
      if (!response || typeof response !== 'object') {
        console.warn('Invalid response structure from Cloudflare API:', response);
        break;
      }

      const items = Array.isArray(response.result) ? response.result : [];
      const resultInfo = response.result_info;

      // Add items to collection
      if (items.length > 0) {
        allItems.push(...items);
      }

      // Determine if there are more pages using result_info
      if (resultInfo && typeof resultInfo === 'object') {
        const currentPage = resultInfo.page ?? page;
        const totalPages = resultInfo.total_pages;

        // Primary check: use total_pages if available (most reliable)
        if (typeof totalPages === 'number' && totalPages > 0) {
          hasMorePages = currentPage < totalPages;
          if (hasMorePages) {
            page++;
          }
        } else {
          // Fallback: if no total_pages, check if we got a full page
          // If we got fewer items than requested, we're on the last page
          hasMorePages = items.length === validPerPage && items.length > 0;
          if (hasMorePages) {
            page++;
          }
        }
      } else {
        // No result_info - check if we got a full page
        // If we got fewer items than per_page, likely last page
        hasMorePages = items.length === validPerPage && items.length > 0;
        if (hasMorePages) {
          page++;
        }
      }

      // Safety check: if no items returned, stop pagination
      if (items.length === 0) {
        hasMorePages = false;
      }
    } catch (error) {
      console.error(`Error paginating Cloudflare API at page ${page}:`, error);
      // If we have items collected so far, return them
      // Otherwise, rethrow the error
      if (allItems.length === 0) {
        throw error;
      }
      // Log warning but return what we have
      console.warn(`Returning partial results (${allItems.length} items) due to pagination error`);
      break;
    }
  }

  return allItems;
}

/**
 * Result of configuring zone settings
 */
export interface ZoneSettingsConfigResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  totalCount: number;
  errors: string[];
  hasAuthError: boolean;
}

/**
 * Progress callback for zone settings configuration
 */
export type ZoneSettingsProgressCallback = (step: {
  name: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  variable?: string; // The setting value being applied (e.g., "strict", "on", "off")
}) => void;

export class CloudflareAPI {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private extractErrorMessage(error: any): string {
    if (!error) return '';

    const data = error.errorData || error.data || error.response?.data;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors
        .map((err: any) => err?.message || err?.error || JSON.stringify(err))
        .filter(Boolean)
        .join('; ');
    }

    if (typeof data?.message === 'string' && data.message.trim().length > 0) {
      return data.message;
    }

    if (Array.isArray(error?.errors) && error.errors.length > 0) {
      return error.errors
        .map((err: any) => err?.message || err?.error || JSON.stringify(err))
        .filter(Boolean)
        .join('; ');
    }

    if (typeof error?.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }

    return '';
  }

  private buildError(fallback: string, error: any): Error {
    const detail = this.extractErrorMessage(error);
    return new Error(detail ? `${fallback}: ${detail}` : fallback);
  }

  private async makeRequest(endpoint: string, options: any = {}, retryCount = 0): Promise<any> {
    const maxRetries = 2;
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

      // Handle HTTP 429 (Too Many Requests) with retry logic
      if (response.status === 429 && retryCount < maxRetries) {
        const retryAfter = response.headers.get('retry-after');
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : Math.pow(2, retryCount) * 5; // Default: exponential backoff (5s, 10s, 20s)
        const waitTime = Math.min(retryAfterSeconds * 1000, 300000); // Cap at 5 minutes

        console.warn(`Rate limit exceeded (429). Retrying after ${retryAfterSeconds} seconds... (attempt ${retryCount + 1}/${maxRetries})`);

        // Wait for retry-after period before retrying
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Retry the request
        return this.makeRequest(endpoint, options, retryCount + 1);
      }

      // Retry once for unknown server errors (e.g., 500 with "unknown" message)
      const isUnknownServerError = response.status >= 500 && response.status < 600 && (
        (Array.isArray(errorData?.errors) && errorData.errors.some((e: any) =>
          e?.code === 500 ||
          (typeof e?.message === 'string' && e.message.toLowerCase().includes('unknown api error'))
        )) ||
        (typeof errorData?.message === 'string' && errorData.message.toLowerCase().includes('unknown api error'))
      );

      if (isUnknownServerError && retryCount < maxRetries) {
        const waitTime = 5000;
        console.warn(`Unknown server error (${response.status}). Retrying in 5s... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.makeRequest(endpoint, options, retryCount + 1);
      }

      // Create error with rate limit information
      const error = new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`) as any;
      error.status = response.status;
      error.statusText = response.statusText;
      error.errorData = errorData;

      // Add retry-after information for 429 errors
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : null;
        error.isRateLimit = true;
      }

      throw error;
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
      throw this.buildError('Failed to fetch accounts', error);
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
      throw this.buildError('Failed to fetch zones', error);
    }
  }

  async getZone(zoneId: string) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}`);
      return response.result;
    } catch (error) {
      console.error('Error fetching zone:', error);
      throw this.buildError('Failed to fetch zone', error);
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

  async deleteZone(zoneId: string) {
    try {
      await this.makeRequest(`/zones/${zoneId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting zone:', error);
      throw this.buildError('Failed to delete zone', error);
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
      throw this.buildError('Failed to fetch DNS records', error);
    }
  }

  async createDNSRecord(zoneId: string, record: any) {
    try {
      const body: any = {
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl || 1,
        proxied: record.proxied || false,
        comment: record.comment,
      };

      // Priority is required for MX records
      if (record.type === 'MX') {
        body.priority = record.priority ?? 10;
      }

      const response = await this.makeRequest(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body,
      });
      return response.result;
    } catch (error) {
      console.error('Error creating DNS record:', error);
      throw this.buildError('Failed to create DNS record', error);
    }
  }

  async updateDNSRecord(zoneId: string, recordId: string, record: any) {
    try {
      const body: any = {
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl || 1,
        proxied: record.proxied || false,
        comment: record.comment,
      };

      // Priority is required for MX records
      if (record.type === 'MX') {
        body.priority = record.priority ?? 10;
      }

      const response = await this.makeRequest(`/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'PATCH',
        body,
      });
      return response.result;
    } catch (error) {
      console.error('Error updating DNS record:', error);
      throw this.buildError('Failed to update DNS record', error);
    }
  }

  async deleteDNSRecord(zoneId: string, recordId: string) {
    try {
      await this.makeRequest(`/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting DNS record:', error);
      throw this.buildError('Failed to delete DNS record', error);
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
      throw this.buildError('Failed to fetch SSL certificates', error);
    }
  }

  async getSSLSetting(zoneId: string) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/settings/ssl`);
      return response.result;
    } catch (error) {
      console.error('Error fetching SSL setting:', error);
      throw this.buildError('Failed to fetch SSL setting', error);
    }
  }

  async updateSSLSetting(zoneId: string, value: string) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/settings/ssl`, {
        method: 'PATCH',
        body: { value },
      });
      return response.result;
    } catch (error) {
      console.error('Error updating SSL setting:', error);
      throw this.buildError('Failed to update SSL setting', error);
    }
  }

  // Zone Settings Management
  private async updateZoneSetting(zoneId: string, setting: string, value: any) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/settings/${setting}`, {
        method: 'PATCH',
        body: { value },
      });
      return response.result;
    } catch (error) {
      console.error(`Error updating ${setting}:`, error);
      throw this.buildError(`Failed to update ${setting}`, error);
    }
  }

  // SSL/TLS Overview: Set to full (strict)
  async setSSLMode(zoneId: string, mode: 'off' | 'flexible' | 'full' | 'strict' = 'strict') {
    return this.updateZoneSetting(zoneId, 'ssl', mode);
  }

  // Edge Certificates: Always use HTTPS
  async setAlwaysUseHTTPS(zoneId: string, enabled: boolean = true) {
    return this.updateZoneSetting(zoneId, 'always_use_https', enabled ? 'on' : 'off');
  }

  // Edge Certificates: HTTP Strict Transport Security (HSTS)
  async setHSTS(zoneId: string, enabled: boolean = true) {
    const hstsValue = enabled
      ? {
        enabled: true,
        max_age: 31536000, // 1 year
        include_subdomains: true,
        preload: true,
      }
      : {
        enabled: false,
      };
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/settings/security_header`, {
        method: 'PATCH',
        body: {
          value: {
            strict_transport_security: hstsValue,
          },
        },
      });
      return response.result;
    } catch (error) {
      console.error('Error updating HSTS:', error);
      throw this.buildError('Failed to update HSTS', error);
    }
  }

  // Edge Certificates: TLS 1.3
  async setTLS13(zoneId: string, enabled: boolean = false) {
    return this.updateZoneSetting(zoneId, 'tls_1_3', enabled ? 'on' : 'off');
  }

  // Origin Server: Authenticated Origin Pulls
  // Reference: https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/zone-level/
  // PATCH /zones/{zone_id}/settings/tls_client_auth
  async setAuthenticatedOriginPulls(zoneId: string, enabled: boolean = true) {
    return this.updateZoneSetting(zoneId, 'tls_client_auth', enabled ? 'on' : 'off');
  }

  // Security: Bot Fight Mode
  // Reference: https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
  // PUT /zones/{zone_id}/bot_management
  // Note: enable_js must be true when fight_mode is enabled
  async setBotFightMode(zoneId: string, enabled: boolean = true) {
    try {
      const response = await this.makeRequest(`/zones/${zoneId}/bot_management`, {
        method: 'PUT',
        body: {
          enable_js: enabled, // Required: JavaScript detection must be enabled for Bot Fight Mode
          fight_mode: enabled,
          ai_bots_protection: "block",
          is_robots_txt_managed: false

        },
      });
      return response.result;
    } catch (error: any) {
      console.error('Error updating Bot Fight Mode:', error);
      throw this.buildError('Failed to update Bot Fight Mode', error);
    }
  }

  // WAF: Create custom rule to skip known bots
  // Reference: https://developers.cloudflare.com/waf/custom-rules/create-api/
  async createSkipBotsWAFRule(zoneId: string) {
    const ruleData = {
      description: 'Skip known bots',
      expression: '(cf.client.bot)',
      action: 'skip',
      action_parameters: {
        ruleset: 'current',
        phases: [
          "http_ratelimit",
          "http_request_firewall_managed",
          "http_request_sbfm"
        ],
        products: [
          "zoneLockdown",
          "bic",
          "uaBlock",
          "hot",
          "securityLevel",
          "rateLimit",
          "waf"
        ],
      },
      enabled: true,
    };

    try {
      // Try to create the entry point ruleset with the rule included
      const response = await this.makeRequest(`/zones/${zoneId}/rulesets`, {
        method: 'POST',
        body: {
          name: 'Custom Rules',
          kind: 'zone',
          phase: 'http_request_firewall_custom',
          rules: [ruleData],
        },
      });

      return response.result;
    } catch (error: any) {
      // If ruleset already exists, try to get it and add the rule
      if (error?.status === 409 || error?.message?.includes('already exists') || error?.message?.includes('409')) {
        try {
          // Get existing rulesets for the zone
          const rulesetsResponse = await this.makeRequest(
            `/zones/${zoneId}/rulesets`,
            { method: 'GET' }
          );

          // Find the entrypoint ruleset for http_request_firewall_custom phase
          const entrypointRuleset = rulesetsResponse.result?.find(
            (ruleset: any) => ruleset.phase === 'http_request_firewall_custom' && ruleset.kind === 'zone'
          );

          if (entrypointRuleset?.id) {
            // Add rule to existing ruleset
            const addRuleResponse = await this.makeRequest(
              `/zones/${zoneId}/rulesets/${entrypointRuleset.id}/rules`,
              {
                method: 'POST',
                body: ruleData,
              }
            );

            return addRuleResponse.result;
          } else {
            throw new Error('Entrypoint ruleset not found');
          }
        } catch (addError) {
          console.error('Error adding rule to existing WAF custom ruleset:', addError);
          throw addError;
        }
      } else {
        console.error('Error creating WAF custom rule:', error);
        throw error;
      }
    }
  }

  // Speed Optimization: Early Hints
  async setEarlyHints(zoneId: string, enabled: boolean = true) {
    return this.updateZoneSetting(zoneId, 'early_hints', enabled ? 'on' : 'off');
  }

  // Speed Optimization: 0-RTT Connection Resumption
  async set0RTT(zoneId: string, enabled: boolean = true) {
    return this.updateZoneSetting(zoneId, '0rtt', enabled ? 'on' : 'off');
  }

  // Network: Pseudo IPv4 - Overwrite Headers
  async setPseudoIPv4(zoneId: string, mode: 'off' | 'add_header' | 'overwrite_header' = 'overwrite_header') {
    return this.updateZoneSetting(zoneId, 'pseudo_ipv4', mode);
  }

  // Scrape Shield: Email Address Obfuscation - off
  async setEmailObfuscation(zoneId: string, enabled: boolean = false) {
    return this.updateZoneSetting(zoneId, 'email_obfuscation', enabled ? 'on' : 'off');
  }

  /**
   * Configure default zone settings for a newly created domain
   * Applies all recommended security and performance settings
   * 
   * Required API Token Permissions:
   * - Zone > Zone > Edit (for zone creation)
   * - Zone > Zone Settings > Edit (for SSL, HTTPS, HSTS, TLS, etc.)
   * - Zone > WAF > Edit (for WAF custom rules - available on free plans)
   * 
   * Reference: https://developers.cloudflare.com/waf/custom-rules/create-api/
   */
  async configureDefaultZoneSettings(
    zoneId: string,
    onProgress?: ZoneSettingsProgressCallback
  ): Promise<ZoneSettingsConfigResult> {
    const errors: string[] = [];
    let successCount = 0;
    let hasAuthError = false;

    const settings = [
      { name: 'SSL mode', variable: 'strict', fn: () => this.setSSLMode(zoneId, 'strict') },
      { name: 'Always use HTTPS', variable: 'on', fn: () => this.setAlwaysUseHTTPS(zoneId, true) },
      { name: 'HSTS', variable: 'on', fn: () => this.setHSTS(zoneId, true) },
      { name: 'TLS 1.3', variable: 'off', fn: () => this.setTLS13(zoneId, false) },
      { name: 'Authenticated Origin Pulls', variable: 'on', fn: () => this.setAuthenticatedOriginPulls(zoneId, true) },
      { name: 'Bot Fight Mode', variable: 'on', fn: () => this.setBotFightMode(zoneId, true) },
      { name: 'WAF Custom Rule', variable: 'skip_bots', fn: () => this.createSkipBotsWAFRule(zoneId) },
      { name: 'Early Hints', variable: 'on', fn: () => this.setEarlyHints(zoneId, true) },
      { name: '0-RTT', variable: 'on', fn: () => this.set0RTT(zoneId, true) },
      { name: 'Pseudo IPv4', variable: 'overwrite_header', fn: () => this.setPseudoIPv4(zoneId, 'overwrite_header') },
      { name: 'Email Obfuscation', variable: 'off', fn: () => this.setEmailObfuscation(zoneId, false) },
    ];

    // Initialize all settings as pending
    if (onProgress) {
      settings.forEach(setting => {
        onProgress({ name: setting.name, status: 'pending', variable: setting.variable });
      });
    }

    for (const setting of settings) {
      // Mark as processing
      if (onProgress) {
        onProgress({ name: setting.name, status: 'processing', variable: setting.variable });
      }

      try {
        await setting.fn();
        successCount++;
        // Mark as success
        if (onProgress) {
          onProgress({ name: setting.name, status: 'success', variable: setting.variable });
        }
      } catch (error: any) {
        // Check for authentication errors (401, 403 status codes)
        const isAuthError =
          error?.status === 401 ||
          error?.status === 403 ||
          (error?.message && (
            error.message.includes('401') ||
            error.message.includes('403') ||
            error.message.toLowerCase().includes('authentication') ||
            error.message.toLowerCase().includes('unauthorized') ||
            error.message.toLowerCase().includes('forbidden')
          ));

        if (isAuthError) {
          hasAuthError = true;
        }

        const errorMessage = error?.message || String(error);
        errors.push(setting.name);
        console.error(`Failed to set ${setting.name}:`, error);

        // Mark as error
        if (onProgress) {
          onProgress({
            name: setting.name,
            status: 'error',
            error: errorMessage,
            variable: setting.variable
          });
        }
      }
    }

    const result: ZoneSettingsConfigResult = {
      success: successCount > 0 && !hasAuthError,
      successCount,
      failureCount: errors.length,
      totalCount: settings.length,
      errors,
      hasAuthError,
    };

    if (hasAuthError) {
      console.error('Authentication error detected. Check API token permissions.');
    } else if (errors.length > 0) {
      console.warn(`Some settings failed to apply: ${errors.join(', ')}`);
    }

    return result;
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