import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Cache data types
interface ZoneData {
  zone: any;
  accountId: string;
  accountName: string;
}

interface DNSRecordsData {
  records: any[];
  zoneId: string;
  accountId: string;
}

interface SSLData {
  certificates: any[];
  sslSetting: any;
  zoneId: string;
  accountId: string;
}

interface ZoneDetailsData {
  zone: any;
  zoneId: string;
  accountId: string;
}

interface RegistrarData {
  registrarName: string;
  accountId: string;
  domains?: string[]; // List of domains managed by this registrar
}

interface NamecheapDomainData {
  accountId: string;
  accountName: string;
  domains: any[];
}

interface CloudflareCacheState {
  // Zones cache
  zones: ZoneData[];
  zonesLastUpdated: number | null;

  // DNS Records cache (keyed by zoneId-accountId)
  dnsRecords: Record<string, DNSRecordsData>;
  dnsRecordsLastUpdated: Record<string, number>;

  // SSL Data cache (keyed by zoneId-accountId)
  sslData: Record<string, SSLData>;
  sslDataLastUpdated: Record<string, number>;

  // Zone Details cache (keyed by zoneId-accountId)
  zoneDetails: Record<string, ZoneDetailsData>;
  zoneDetailsLastUpdated: Record<string, number>;

  // Registrar Data cache (keyed by accountId)
  registrarData: Record<string, RegistrarData>;
  registrarDataLastUpdated: Record<string, number>;

  // Namecheap Domains cache (keyed by accountId)
  namecheapDomains: Record<string, NamecheapDomainData>;
  namecheapDomainsLastUpdated: Record<string, number>;
  
  // Loading states
  isLoading: {
    zones: boolean;
    dnsRecords: Record<string, boolean>;
    sslData: Record<string, boolean>;
    zoneDetails: Record<string, boolean>;
    registrarData: Record<string, boolean>;
    namecheapDomains: Record<string, boolean>;
  };
  
  // Cache management
  setZones: (zones: ZoneData[]) => void;
  addZone: (zone: any, accountId: string, accountName: string) => void;
  removeZone: (zoneId: string, accountId: string) => void;
  setDNSRecords: (zoneId: string, accountId: string, records: any[]) => void;
  setSSLData: (zoneId: string, accountId: string, certificates: any[], sslSetting: any) => void;
  setZoneDetails: (zoneId: string, accountId: string, zone: any) => void;
  setRegistrarData: (accountId: string, registrarName: string, domains?: string[]) => void;
  setNamecheapDomains: (accountId: string, accountName: string, domains: any[]) => void;
  
  setLoading: (type: string, key: string, loading: boolean) => void;
  
  clearCache: () => void;
  clearZoneCache: (zoneId: string, accountId: string) => void;
  
  isCacheValid: (type: string, key?: string) => boolean;
  
  // Getters
  getZones: () => ZoneData[];
  getDNSRecords: (zoneId: string, accountId: string) => any[];
  getSSLData: (zoneId: string, accountId: string) => { certificates: any[]; sslSetting: any } | null;
  getZoneDetails: (zoneId: string, accountId: string) => any | null;
  getRegistrarData: (accountId: string) => RegistrarData | null;
  getNamecheapDomains: (accountId: string) => NamecheapDomainData | null;
}

interface CloudflareCacheStateWithHydration extends CloudflareCacheState {
  _hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useCloudflareCache = create<CloudflareCacheStateWithHydration>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),
      // Initial state
      zones: [],
      zonesLastUpdated: null,
      
      dnsRecords: {},
      dnsRecordsLastUpdated: {},
      
      sslData: {},
      sslDataLastUpdated: {},
      
      zoneDetails: {},
      zoneDetailsLastUpdated: {},

      registrarData: {},
      registrarDataLastUpdated: {},

      namecheapDomains: {},
      namecheapDomainsLastUpdated: {},

      isLoading: {
        zones: false,
        dnsRecords: {},
        sslData: {},
        zoneDetails: {},
        registrarData: {},
        namecheapDomains: {},
      },
      
      // Setters
      setZones: (zones) => set({ 
        zones, 
        zonesLastUpdated: Date.now() 
      }),
      
      addZone: (zone, accountId, accountName) => {
        set((state) => {
          // Check if zone already exists to avoid duplicates
          const zoneKey = `${accountId}-${zone.id}`;
          const exists = state.zones.some(
            (z) => `${z.accountId}-${z.zone.id}` === zoneKey
          );
          
          if (exists) {
            // Update existing zone
            return {
              zones: state.zones.map((z) =>
                `${z.accountId}-${z.zone.id}` === zoneKey
                  ? { zone, accountId, accountName }
                  : z
              ),
              zonesLastUpdated: Date.now(),
            };
          } else {
            // Add new zone
            return {
              zones: [...state.zones, { zone, accountId, accountName }],
              zonesLastUpdated: Date.now(),
            };
          }
        });
      },
      
      removeZone: (zoneId, accountId) => {
        set((state) => {
          // Remove zone from zones array
          const updatedZones = state.zones.filter(
            (z) => !(z.zone.id === zoneId && z.accountId === accountId)
          );
          
          // Also clear all related cache for this zone
          const key = `${zoneId}-${accountId}`;
          const newState = { ...state };
          delete newState.dnsRecords[key];
          delete newState.dnsRecordsLastUpdated[key];
          delete newState.sslData[key];
          delete newState.sslDataLastUpdated[key];
          delete newState.zoneDetails[key];
          delete newState.zoneDetailsLastUpdated[key];
          delete newState.isLoading.dnsRecords[key];
          delete newState.isLoading.sslData[key];
          delete newState.isLoading.zoneDetails[key];
          
          return {
            ...newState,
            zones: updatedZones,
            zonesLastUpdated: updatedZones.length > 0 ? (state.zonesLastUpdated || Date.now()) : null,
          };
        });
      },
      
      setDNSRecords: (zoneId, accountId, records) => {
        const key = `${zoneId}-${accountId}`;
        set((state) => ({
          dnsRecords: {
            ...state.dnsRecords,
            [key]: { records, zoneId, accountId }
          },
          dnsRecordsLastUpdated: {
            ...state.dnsRecordsLastUpdated,
            [key]: Date.now()
          }
        }));
      },
      
      setSSLData: (zoneId, accountId, certificates, sslSetting) => {
        const key = `${zoneId}-${accountId}`;
        set((state) => ({
          sslData: {
            ...state.sslData,
            [key]: { certificates, sslSetting, zoneId, accountId }
          },
          sslDataLastUpdated: {
            ...state.sslDataLastUpdated,
            [key]: Date.now()
          }
        }));
      },
      
      setZoneDetails: (zoneId, accountId, zone) => {
        const key = `${zoneId}-${accountId}`;
        set((state) => ({
          zoneDetails: {
            ...state.zoneDetails,
            [key]: { zone, zoneId, accountId }
          },
          zoneDetailsLastUpdated: {
            ...state.zoneDetailsLastUpdated,
            [key]: Date.now()
          }
        }));
      },

      setRegistrarData: (accountId, registrarName, domains) => {
        set((state) => ({
          registrarData: {
            ...state.registrarData,
            [accountId]: { registrarName, accountId, domains }
          },
          registrarDataLastUpdated: {
            ...state.registrarDataLastUpdated,
            [accountId]: Date.now()
          }
        }));
      },

      setNamecheapDomains: (accountId, accountName, domains) => {
        set((state) => ({
          namecheapDomains: {
            ...state.namecheapDomains,
            [accountId]: { accountId, accountName, domains }
          },
          namecheapDomainsLastUpdated: {
            ...state.namecheapDomainsLastUpdated,
            [accountId]: Date.now()
          }
        }));
      },
      
      setLoading: (type, key, loading) => {
        set((state) => ({
          isLoading: {
            ...state.isLoading,
            [type]: type === 'zones' ? loading : {
              ...(state.isLoading[type as keyof typeof state.isLoading] as Record<string, boolean>),
              [key]: loading
            }
          }
        }));
      },
      
      // Cache management
      clearCache: () => set({
        zones: [],
        zonesLastUpdated: null,
        dnsRecords: {},
        dnsRecordsLastUpdated: {},
        sslData: {},
        sslDataLastUpdated: {},
        zoneDetails: {},
        zoneDetailsLastUpdated: {},
        registrarData: {},
        registrarDataLastUpdated: {},
        namecheapDomains: {},
        namecheapDomainsLastUpdated: {},
        isLoading: {
          zones: false,
          dnsRecords: {},
          sslData: {},
          zoneDetails: {},
          registrarData: {},
          namecheapDomains: {},
        }
      }),
      
      clearZoneCache: (zoneId, accountId) => {
        const key = `${zoneId}-${accountId}`;
        set((state) => {
          const newState = { ...state };
          delete newState.dnsRecords[key];
          delete newState.dnsRecordsLastUpdated[key];
          delete newState.sslData[key];
          delete newState.sslDataLastUpdated[key];
          delete newState.zoneDetails[key];
          delete newState.zoneDetailsLastUpdated[key];
          delete newState.isLoading.dnsRecords[key];
          delete newState.isLoading.sslData[key];
          delete newState.isLoading.zoneDetails[key];
          return newState;
        });
      },
      
      // Cache validation - cache never expires automatically, only updates manually
      isCacheValid: (type, key) => {
        const state = get();

        switch (type) {
          case 'zones':
            // Cache is valid if it exists (never expires automatically)
            return state.zonesLastUpdated !== null && state.zones.length > 0;

          case 'dnsRecords':
          case 'sslData':
          case 'zoneDetails':
          case 'registrarData':
          case 'namecheapDomains':
            if (!key) return false;
            const lastUpdated = state[`${type}LastUpdated` as keyof typeof state] as Record<string, number>;
            const cacheData = state[type as keyof typeof state] as Record<string, any>;
            // Cache is valid if it exists (never expires automatically)
            return lastUpdated[key] !== undefined && cacheData[key] !== undefined;

          default:
            return false;
        }
      },
      
      // Getters
      getZones: () => get().zones,
      
      getDNSRecords: (zoneId, accountId) => {
        const key = `${zoneId}-${accountId}`;
        return get().dnsRecords[key]?.records || [];
      },
      
      getSSLData: (zoneId, accountId) => {
        const key = `${zoneId}-${accountId}`;
        const data = get().sslData[key];
        return data ? { certificates: data.certificates, sslSetting: data.sslSetting } : null;
      },
      
      getZoneDetails: (zoneId, accountId) => {
        const key = `${zoneId}-${accountId}`;
        return get().zoneDetails[key]?.zone || null;
      },

      getRegistrarData: (accountId) => {
        return get().registrarData[accountId] || null;
      },

      getNamecheapDomains: (accountId) => {
        return get().namecheapDomains[accountId] || null;
      },
    }),
    {
      name: 'cloudflare-cache',
      partialize: (state) => ({
        zones: state.zones,
        zonesLastUpdated: state.zonesLastUpdated,
        dnsRecords: state.dnsRecords,
        dnsRecordsLastUpdated: state.dnsRecordsLastUpdated,
        sslData: state.sslData,
        sslDataLastUpdated: state.sslDataLastUpdated,
        zoneDetails: state.zoneDetails,
        zoneDetailsLastUpdated: state.zoneDetailsLastUpdated,
        registrarData: state.registrarData,
        registrarDataLastUpdated: state.registrarDataLastUpdated,
        namecheapDomains: state.namecheapDomains,
        namecheapDomainsLastUpdated: state.namecheapDomainsLastUpdated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
