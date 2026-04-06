import type { NamecheapDomain } from './namecheap';
import type { NjallaDomain } from './njalla';
import type { DynadotDomain } from './dynadot';
import {
  isDynadotUsingOurDNS,
  normalizeDynadotRenewOption,
  normalizeDynadotStatus,
  parseDynadotTimestamp,
} from '@/lib/dynadot-utils';

export type RegistrarType = 'namecheap' | 'njalla' | 'dynadot';

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
  // Dynadot specific fields
  dynadotDomain?: DynadotDomain;
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

/**
 * Converts a Dynadot domain to UnifiedDomain format
 */
export function toUnifiedDomainFromDynadot(domain: DynadotDomain, accountId: string): UnifiedDomain {
  const normalizedDomain: DynadotDomain = {
    ...domain,
    isUsingOurDNS:
      domain.isUsingOurDNS ?? isDynadotUsingOurDNS(domain.NameServerSettings),
  };

  return {
    id: `dynadot-${domain.Name}`,
    name: domain.Name,
    registrar: 'dynadot',
    status: normalizeDynadotStatus(normalizedDomain),
    expiry: parseDynadotTimestamp(domain.Expiration),
    autorenew: normalizeDynadotRenewOption(domain.RenewOption),
    accountId,
    dynadotDomain: normalizedDomain,
  };
}
