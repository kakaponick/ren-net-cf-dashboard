export type RegistrarColumnKey = 'nameservers' | 'registrar' | 'status' | 'expires' | 'autorenew' | 'privacy' | 'premium' | 'dns' | 'email';

export type RegistrarColumnVisibility = Record<RegistrarColumnKey, boolean>;

export const REGISTRAR_COLUMN_LABELS: Record<RegistrarColumnKey, string> = {
    nameservers: 'Nameservers',
    registrar: 'Registrar',
    status: 'Status',
    expires: 'Expires',
    autorenew: 'Auto Renew',
    privacy: 'Privacy',
    premium: 'Premium',
    dns: 'DNS',
    email: 'Email'
};

export const REGISTRAR_COLUMN_KEYS: RegistrarColumnKey[] = [
    'nameservers',
    'registrar',
    'status',
    'expires',
    'autorenew',
    'privacy',
    'premium',
    'dns',
    'email'
];

export const DEFAULT_REGISTRAR_COLUMN_VISIBILITY: RegistrarColumnVisibility = REGISTRAR_COLUMN_KEYS.reduce(
    (acc, key) => {
        acc[key] = true;
        return acc;
    },
    {} as RegistrarColumnVisibility
);

const REGISTRAR_COLUMNS_STORAGE_KEY = 'registrars-table-column-visibility';

const normalizeVisibility = (value: Partial<RegistrarColumnVisibility> | null | undefined): RegistrarColumnVisibility => {
    const normalized: RegistrarColumnVisibility = { ...DEFAULT_REGISTRAR_COLUMN_VISIBILITY };
    if (!value) return normalized;

    for (const key of REGISTRAR_COLUMN_KEYS) {
        if (typeof value[key] === 'boolean') {
            normalized[key] = value[key] as boolean;
        }
    }
    return normalized;
};

export const loadRegistrarColumnVisibility = (): RegistrarColumnVisibility => {
    if (typeof window === 'undefined') {
        return { ...DEFAULT_REGISTRAR_COLUMN_VISIBILITY };
    }

    try {
        const stored = localStorage.getItem(REGISTRAR_COLUMNS_STORAGE_KEY);
        const parsed = stored ? (JSON.parse(stored) as Partial<RegistrarColumnVisibility>) : null;
        return normalizeVisibility(parsed);
    } catch (error) {
        console.error('Error reading registrar column visibility:', error);
        return { ...DEFAULT_REGISTRAR_COLUMN_VISIBILITY };
    }
};

export const saveRegistrarColumnVisibility = (visibility: RegistrarColumnVisibility): void => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(REGISTRAR_COLUMNS_STORAGE_KEY, JSON.stringify(normalizeVisibility(visibility)));
    } catch (error) {
        console.error('Error saving registrar column visibility:', error);
    }
};
