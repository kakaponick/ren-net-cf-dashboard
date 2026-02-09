import { create } from 'zustand';
import type { NPMSettings, NPMToken } from '@/types/npm';

interface NPMStore {
    settings: NPMSettings | null;
    token: NPMToken | null;
    isLoading: boolean;
    error: string | null;

    loadSettings: () => void;
    saveSettings: (settings: NPMSettings) => void;
    clearSettings: () => void;

    setToken: (token: NPMToken) => void;
    clearToken: () => void;
    isTokenValid: () => boolean;

    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
}

const SETTINGS_STORAGE_KEY = 'npm-settings';
const TOKEN_STORAGE_KEY = 'npm-token';

const loadStoredSettings = (): NPMSettings | null => {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!stored) return null;

        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && parsed.host && parsed.identity && parsed.secret) {
            return parsed as NPMSettings;
        }
        return null;
    } catch (error) {
        console.error('Failed to load NPM settings:', error);
        return null;
    }
};

const saveStoredSettings = (settings: NPMSettings): void => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save NPM settings:', error);
    }
};

const clearStoredSettings = (): void => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear NPM settings:', error);
    }
};

const loadStoredToken = (): NPMToken | null => {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!stored) return null;

        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && parsed.token && parsed.expires) {
            return parsed as NPMToken;
        }
        return null;
    } catch (error) {
        console.error('Failed to load NPM token:', error);
        return null;
    }
};

const saveStoredToken = (token: NPMToken): void => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
    } catch (error) {
        console.error('Failed to save NPM token:', error);
    }
};

const clearStoredToken = (): void => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear NPM token:', error);
    }
};

export const useNPMStore = create<NPMStore>((set, get) => ({
    settings: loadStoredSettings(),
    token: loadStoredToken(),
    isLoading: false,
    error: null,

    loadSettings: () => {
        const settings = loadStoredSettings();
        set({ settings });
    },

    saveSettings: (settings) => {
        saveStoredSettings(settings);
        set({ settings });
    },

    clearSettings: () => {
        clearStoredSettings();
        clearStoredToken();
        set({ settings: null, token: null });
    },

    setToken: (token) => {
        saveStoredToken(token);
        set({ token });
    },

    clearToken: () => {
        clearStoredToken();
        set({ token: null });
    },

    isTokenValid: () => {
        const { token } = get();
        if (!token) return false;

        try {
            const expiresAt = new Date(token.expires).getTime();
            const now = Date.now();
            // Consider token invalid if it expires within 1 minute
            return expiresAt > now + 60000;
        } catch {
            return false;
        }
    },

    setLoading: (loading) => {
        set({ isLoading: loading });
    },

    setError: (error) => {
        set({ error });
    },

    clearError: () => {
        set({ error: null });
    },
}));
