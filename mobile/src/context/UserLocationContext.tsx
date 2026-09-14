import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentAddress, GeoAddress } from '../services/location';

const CACHE_KEY = '@bagup_user_location';

type UserLocationContextType = {
  address: GeoAddress | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<GeoAddress | null>;
  shortLabel: string;
};

const UserLocationContext = createContext<UserLocationContextType>({
  address: null,
  loading: false,
  error: null,
  refresh: async () => null,
  shortLabel: '',
});

function formatShortLabel(addr: GeoAddress | null): string {
  if (!addr) return '';
  const parts = addr.label
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[parts.length - 1]}`;
  }
  if (addr.city) return addr.city;
  return addr.label;
}

export const UserLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<GeoAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshing = useRef(false);
  const addressRef = useRef<GeoAddress | null>(null);

  const persist = useCallback(async (addr: GeoAddress) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(addr));
    } catch {
      // ignore cache write errors
    }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return addressRef.current;
    refreshing.current = true;
    setLoading(true);
    setError(null);
    try {
      const addr = await getCurrentAddress();
      if (addr) {
        addressRef.current = addr;
        setAddress(addr);
        await persist(addr);
        return addr;
      }
      setError('Position introuvable');
      return null;
    } catch (e: any) {
      setError(e?.message || 'Localisation indisponible');
      return null;
    } finally {
      setLoading(false);
      refreshing.current = false;
    }
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached) as GeoAddress;
          if (parsed?.lat && parsed?.lng && parsed?.label) {
            addressRef.current = parsed;
            setAddress(parsed);
            setLoading(false);
          }
        }
      } catch {
        // ignore
      }
      if (!cancelled) {
        await refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  const value = useMemo(
    () => ({
      address,
      loading,
      error,
      refresh,
      shortLabel: formatShortLabel(address),
    }),
    [address, loading, error, refresh],
  );

  return (
    <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>
  );
};

export function useUserLocation() {
  return useContext(UserLocationContext);
}
