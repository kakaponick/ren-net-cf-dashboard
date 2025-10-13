export interface CloudflareAccount {
  id: string;
  name: string;
  email: string;
  apiToken: string;
}

export interface Zone {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated';
  name_servers: string[];
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    frequency: string;
  };
  development_mode: number;
  original_name_servers: string[];
  original_registrar: string;
  original_dnshost: string;
  modified_on: string;
  created_on: string;
  activated_on: string;
  meta: {
    step: number;
    custom_certificate_quota: number;
    page_rule_quota: number;
    phishing_detected: boolean;
    multiple_railguns_allowed: boolean;
  };
  owner: {
    id: string;
    type: string;
    email: string;
  };
  account: {
    id: string;
    name: string;
  };
  permissions: string[];
}

export interface DNSRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS' | 'PTR' | 'CAA' | 'LOC' | 'SSHFP' | 'TLSA' | 'URI';
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
  meta: {
    auto_added: boolean;
    managed_by_apps: boolean;
    managed_by_argo_tunnel: boolean;
    source: string;
  };
  comment?: string;
  tags: string[];
  created_on: string;
  modified_on: string;
}

export interface SSLCertificate {
  id: string;
  type: 'dedicated' | 'shared' | 'custom';
  hosts: string[];
  issuer: string;
  signature: string;
  status: 'active' | 'pending_validation' | 'pending_issuance' | 'pending_deployment' | 'validation_timed_out' | 'issuance_timed_out' | 'deployment_timed_out' | 'failed' | 'cancelled' | 'revoked' | 'expired';
  method: 'http' | 'cname' | 'email' | 'tls' | 'txt';
  validation_records: Array<{
    cname_target: string;
    cname: string;
    txt_name: string;
    txt_value: string;
  }>;
  validation_errors: Array<{
    message: string;
  }>;
  validity_days: number;
  certificate_authority: string;
  cloudflare_branding: boolean;
  custom_certificate_id: string;
  custom_certificate_key: string;
  custom_certificate_bundle: string;
  created_on: string;
  modified_on: string;
  expires_on: string;
}

export interface SSLSetting {
  id: string;
  value: 'off' | 'flexible' | 'full' | 'strict';
  modified_on: string;
  editable: boolean;
}
