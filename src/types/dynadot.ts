export interface DynadotNameServerSettings {
  Type?: string;
  WithAds?: string;
}

export interface DynadotDomain {
  Name: string;
  Expiration: string;
  Registration?: string;
  NameServerSettings?: DynadotNameServerSettings;
  Locked?: string;
  Disabled?: string;
  Hold?: string;
  RenewOption?: string;
  Status?: string;
  accountId?: string;
  registrar?: 'dynadot';
  isUsingOurDNS?: boolean;
}

export interface DynadotAccount {
  id: string;
  name?: string;
  email: string;
  apiKey: string;
  createdAt: Date;
}

export interface DynadotDomainsResponse {
  domains: DynadotDomain[];
  account: DynadotAccount;
}
