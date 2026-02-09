export interface NPMSettings {
    host: string;
    identity: string;
    secret: string;
}

export interface NPMToken {
    token: string;
    expires: string;
}

export interface NPMAuthResponse {
    token: string;
    expires: string;
    user: {
        id: number;
        created_on: string;
        modified_on: string;
        is_deleted: number;
        is_disabled: number;
        email: string;
        name: string;
        nickname: string;
        avatar: string;
        roles: string[];
    };
}

export interface NPMRedirect {
    id?: number;
    created_on?: string;
    modified_on?: string;
    domain_names: string[];
    forward_scheme: string;
    forward_domain_name: string;
    forward_port?: number;
    certificate_id: number | string;
    ssl_forced: boolean | number;
    hsts_enabled: boolean | number;
    hsts_subdomains: boolean | number;
    http2_support: boolean | number;
    block_exploits: boolean | number;
    enabled?: boolean | number;
    meta: {
        letsencrypt_agree: boolean;
        dns_challenge: boolean;
        nginx_online?: boolean;
        nginx_err?: string;
        [key: string]: unknown;
    };
    preserve_path: boolean | number;
    forward_http_code: number | string;
    advanced_config?: string;
}

export interface NPMRedirectListResponse {
    id: number;
    created_on: string;
    modified_on: string;
    domain_names: string[];
    forward_scheme: string;
    forward_domain_name: string;
    forward_port: number;
    certificate_id: number | string;
    ssl_forced: number;
    hsts_enabled: number;
    hsts_subdomains: number;
    http2_support: number;
    block_exploits: number;
    enabled: number;
    meta: Record<string, unknown>;
    preserve_path: number;
    forward_http_code: number;
    advanced_config?: string;
}

export interface ParsedNginxLocation {
    location: string;
    destination: string;
    sourceDomain: string;
    isDuplicate?: boolean;
}
