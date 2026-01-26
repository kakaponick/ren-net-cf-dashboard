import type { NamecheapDomain } from './namecheap';
import type { NjallaDomain } from './njalla';

export type RegistrarType = 'namecheap' | 'njalla';

export interface UnifiedDomain {
  id: string; // Unique identifier combining registrar + domain name
  name: string;
  registrar: RegistrarType;
  status: 'active' | 'expired' | 'locked' | 'inactive' | string;
  expiry: string; // ISO 8601 or MM/DD/YYYY format
  autorenew: boolean;
  accountId: string;
  // Namecheap specific fields
  ncDomain?: NamecheapDomain;
  // Njalla specific fields
  njallaDomain?: NjallaDomain;
}

/**
 * Converts a Namecheap domain to UnifiedDomain format
 */
export function toUnifiedDomain(domain: NamecheapDomain, accountId: string): UnifiedDomain {
  let status: UnifiedDomain['status'] = 'active';
  if (domain.IsExpired) status = 'expired';
  else if (domain.IsLocked) status = 'locked';

  return {
    id: `nc-${domain.ID}`,
    name: domain.Name,
    registrar: 'namecheap',
    status,
    expiry: domain.Expires,
    autorenew: domain.AutoRenew,
    accountId,
    ncDomain: domain,
  };
}

/**
 * Converts a Njalla domain to UnifiedDomain format
 */
export function toUnifiedDomainFromNjalla(domain: NjallaDomain, accountId: string): UnifiedDomain {
  return {
    id: `njalla-${domain.name}`,
    name: domain.name,
    registrar: 'njalla',
    status: domain.status === 'active' ? 'active' : domain.status === 'inactive' ? 'inactive' : domain.status,
    expiry: domain.expiry,
    autorenew: domain.autorenew,
    accountId,
    njallaDomain: domain,
  };
}
