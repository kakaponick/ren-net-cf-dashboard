export type DomainColumnKey = 'status' | 'proxied' | 'rootARecord' | 'account' | 'created' | 'sslTls';

export type DomainColumnVisibility = Record<DomainColumnKey, boolean>;

export const DOMAIN_COLUMN_LABELS: Record<DomainColumnKey, string> = {
	status: 'Status',
	proxied: 'Proxied',
	rootARecord: 'A Record',
	account: 'Account',
	created: 'Created',
	sslTls: 'SSL/TLS'
};

export const DOMAIN_COLUMN_KEYS: DomainColumnKey[] = [
	'status',
	'proxied',
	'rootARecord',
	'sslTls',
	'account',
	'created'
];

export const DEFAULT_DOMAIN_COLUMN_VISIBILITY: DomainColumnVisibility = DOMAIN_COLUMN_KEYS.reduce(
		(acc, key) => {
				acc[key] = true;
				return acc;
		},
		{} as DomainColumnVisibility
);

const DOMAIN_COLUMNS_STORAGE_KEY = 'domains-table-column-visibility';

const normalizeVisibility = (value: Partial<DomainColumnVisibility> | null | undefined): DomainColumnVisibility => {
		const normalized: DomainColumnVisibility = { ...DEFAULT_DOMAIN_COLUMN_VISIBILITY };
		if (!value) return normalized;

		for (const key of DOMAIN_COLUMN_KEYS) {
				if (typeof value[key] === 'boolean') {
						normalized[key] = value[key] as boolean;
				}
		}
		return normalized;
};

export const loadDomainColumnVisibility = (): DomainColumnVisibility => {
		if (typeof window === 'undefined') {
				return { ...DEFAULT_DOMAIN_COLUMN_VISIBILITY };
		}

		try {
				const stored = localStorage.getItem(DOMAIN_COLUMNS_STORAGE_KEY);
				const parsed = stored ? (JSON.parse(stored) as Partial<DomainColumnVisibility>) : null;
				return normalizeVisibility(parsed);
		} catch (error) {
				console.error('Error reading domain column visibility:', error);
				return { ...DEFAULT_DOMAIN_COLUMN_VISIBILITY };
		}
};

export const saveDomainColumnVisibility = (visibility: DomainColumnVisibility): void => {
		if (typeof window === 'undefined') return;

		try {
				localStorage.setItem(DOMAIN_COLUMNS_STORAGE_KEY, JSON.stringify(normalizeVisibility(visibility)));
		} catch (error) {
				console.error('Error saving domain column visibility:', error);
		}
};

