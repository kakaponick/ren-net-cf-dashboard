import type { NPMSettings, NPMAuthResponse, NPMRedirect, NPMRedirectListResponse } from '@/types/npm';

export class NPMAPIClient {
    private settings: NPMSettings;
    private token: string | null = null;
    private onTokenRefresh?: (token: string, expires: string) => void;

    constructor(settings: NPMSettings, token?: string, onTokenRefresh?: (token: string, expires: string) => void) {
        this.settings = settings;
        this.token = token || null;
        this.onTokenRefresh = onTokenRefresh;
    }

    /**
     * Authenticate and get a bearer token
     */
    async authenticate(): Promise<NPMAuthResponse> {
        const response = await fetch('/api/npm/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                host: this.settings.host,
                identity: this.settings.identity,
                secret: this.settings.secret,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Authentication failed: ${error}`);
        }

        const data: NPMAuthResponse = await response.json();
        this.token = data.token;

        if (this.onTokenRefresh) {
            this.onTokenRefresh(data.token, data.expires);
        }

        return data;
    }

    /**
     * Make an authenticated request to NPM API
     * Automatically retries once with token refresh on 401
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        retryOnAuth = true
    ): Promise<T> {
        if (!this.token) {
            await this.authenticate();
        }

        const url = `/api/npm/proxy`;
        const response = await fetch(url, {
            ...options,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-NPM-Host': this.settings.host,
                'X-NPM-Token': this.token!,
                'X-NPM-Endpoint': endpoint,
                ...options.headers,
            },
        });

        // Handle 401 - token might be expired
        if (response.status === 401 && retryOnAuth) {
            await this.authenticate();
            // Retry the request once
            return this.request<T>(endpoint, options, false);
        }

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`NPM API error: ${error}`);
        }

        const data = await response.json();

        // Check for nginx configuration errors even in successful responses
        if (data && typeof data === 'object' && 'meta' in data) {
            const meta = (data as any).meta;
            if (meta?.nginx_err) {
                // Create error object with nginx error details
                const error: any = new Error('Nginx configuration error');
                error.nginxError = meta.nginx_err;
                error.meta = meta;
                throw error;
            }
        }

        return data;
    }

    /**
     * Get all redirects
     */
    async getRedirects(): Promise<NPMRedirectListResponse[]> {
        return this.request<NPMRedirectListResponse[]>('/api/nginx/redirection-hosts', {
            method: 'GET',
        });
    }

    /**
     * Get a single redirect by ID
     */
    async getRedirect(id: number): Promise<NPMRedirectListResponse> {
        return this.request<NPMRedirectListResponse>(`/api/nginx/redirection-hosts/${id}`, {
            method: 'GET',
        });
    }

    /**
     * Create a new redirect
     */
    async createRedirect(data: Partial<NPMRedirect>): Promise<NPMRedirectListResponse> {
        return this.request<NPMRedirectListResponse>('/api/nginx/redirection-hosts', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Update a redirect
     */
    async updateRedirect(id: number, data: Partial<NPMRedirect>): Promise<NPMRedirectListResponse> {
        return this.request<NPMRedirectListResponse>(`/api/nginx/redirection-hosts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * Delete a redirect
     */
    async deleteRedirect(id: number): Promise<boolean> {
        await this.request<void>(`/api/nginx/redirection-hosts/${id}`, {
            method: 'DELETE',
        });
        return true;
    }

    /**
     * Test connection to NPM
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.authenticate();
            return true;
        } catch {
            return false;
        }
    }
}
