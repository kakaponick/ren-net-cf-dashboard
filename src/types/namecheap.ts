export interface NamecheapDomain {
  ID: number;
  Name: string;
  User: string;
  Created: string; // MM/DD/YYYY format
  Expires: string; // MM/DD/YYYY format
  IsExpired: boolean;
  IsLocked: boolean;
  AutoRenew: boolean;
  WhoisGuard: 'ENABLED' | 'NOTPRESENT' | string;
  IsPremium: boolean;
  IsOurDNS: boolean;
  accountId?: string;
  registrar?: 'namecheap';
}

export interface NamecheapApiResponse {
  ApiResponse: {
    $: {
      Status: 'OK' | 'ERROR';
    };
    Errors: Array<{
      Error?: string;
    }>;
    RequestedCommand: string[];
    CommandResponse: Array<{
      $: {
        Type: string;
      };
      DomainGetListResult: Array<{
        Domain: Array<{
          $: NamecheapDomain;
        }>;
      }>;
      Paging: Array<{
        TotalItems: string[];
        CurrentPage: string[];
        PageSize: string[];
      }>;
    }>;
    Server: string[];
    GMTTimeDifference: string[];
    ExecutionTime: string[];
  };
}

export interface NamecheapAccount {
  id: string;
  name?: string;
  email: string;
  apiUser: string; // API username (stored in CloudflareAccount.username)
  apiKey: string;
  proxyId?: string; // Reference to proxy account for client IP
  createdAt: Date;
}

export interface NamecheapDomainsResponse {
  domains: NamecheapDomain[];
  paging: {
    totalItems: number;
    currentPage: number;
    pageSize: number;
  };
  account: NamecheapAccount;
}