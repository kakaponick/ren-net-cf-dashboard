import type { DynadotDomain } from '@/types/dynadot';

export function parseDynadotTimestamp(timestamp: string | number | null | undefined): string {
  if (timestamp === null || timestamp === undefined || timestamp === '') {
    return '';
  }

  const value = typeof timestamp === 'number' ? timestamp : Number(timestamp);
  if (!Number.isFinite(value)) {
    return '';
  }

  return new Date(value).toISOString();
}

export function isDynadotUsingOurDNS(
  settings?: DynadotDomain['NameServerSettings'] | null
): boolean {
  const type = settings?.Type?.toLowerCase() ?? '';
  return type.includes('dynadot');
}

export function normalizeDynadotRenewOption(renewOption?: string | null): boolean {
  const value = renewOption?.toLowerCase() ?? '';
  return value.includes('auto');
}

export function normalizeDynadotStatus(domain: DynadotDomain): string {
  const status = domain.Status?.toLowerCase() ?? '';
  if (status === 'active') return 'active';
  if (status === 'expired') return 'expired';
  if (status === 'inactive') return 'inactive';
  if (domain.Locked?.toLowerCase() === 'yes') return 'locked';
  if (domain.Disabled?.toLowerCase() === 'yes') return 'inactive';
  if (domain.Hold?.toLowerCase() === 'yes') return 'inactive';
  return status || 'active';
}

export function extractDynadotHosts(content: Record<string, unknown> | null | undefined): string[] {
  if (!content) return [];

  return Object.entries(content)
    .filter(
      (entry): entry is [string, string] =>
        entry[0].toLowerCase().startsWith('host') && typeof entry[1] === 'string'
    )
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, value]) => value.trim())
    .filter(Boolean);
}
