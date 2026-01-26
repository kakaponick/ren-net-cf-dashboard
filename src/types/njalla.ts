export interface NjallaDomain {
  name: string;
  status: 'active' | 'inactive' | string;
  expiry: string; // ISO 8601 format
  autorenew: boolean;
  registrar?: 'njalla';
  accountId?: string;
}

export interface NjallaAccount {
  id: string;
  name?: string;
  email: string;
  apiKey: string;
  createdAt: Date;
}
