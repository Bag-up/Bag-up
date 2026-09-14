import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface AuthUser {
  id: string;
  phone: string;
  role: 'client' | 'provider' | 'merchant';
  isVerified?: boolean;
  phoneVerified?: boolean;
  kycRejectedAt?: string | null;
  kycRejectReason?: string | null;
  subscriptionRefundPending?: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
  subscriptionStatus?: string;
  subscriptionExpiry?: string | null;
  referralCode?: string;
  credit?: number;
  isAvailable?: boolean;
  rating?: number;
  totalRatings?: number;
  vehicleType?: string;
  vehicle?: {
    type?: string;
    plate?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    photoUrl?: string | null;
  } | null;
  zone?: string;
  address?: string;
  country?: string;
  avatarUrl?: string;
  businessName?: string;
  businessAddress?: string;
  merchantChannels?: string[];
  serviceCategories?: string;
  demarchesServiceFee?: number | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  online: boolean;
  setOnline: (v: boolean) => void;
  login: (identifier: string, password: string, role?: 'client' | 'provider' | 'merchant', remember?: boolean) => Promise<void>;
  register: (data: {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    role: string;
    email?: string;
    address?: string;
    country?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehiclePhotoUrl?: string;
    idCardUrl?: string;
    idCardBackUrl?: string;
    licenseUrl?: string;
    avatarUrl?: string;
    zone?: string;
    serviceCategories?: string;
    demarchesServiceFee?: number;
    businessName?: string;
    businessAddress?: string;
    merchantChannels?: string[];
    referredBy?: string;
  }) => Promise<void>;
  logout: () => void;
  deleteAccount: (password: string) => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  pendingOtp: { sent: boolean; channel?: 'sms' | 'email'; destination?: string; devCode?: string } | null;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const STORAGE_KEY = '@bagup_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [pendingOtp, setPendingOtp] = useState<{
    sent: boolean;
    channel?: 'sms' | 'email';
    destination?: string;
    devCode?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setToken(parsed.token);
          setUser(parsed.user);
          // Rafraîchir le profil AVANT de lever isLoading, sinon l'écran OTP
          // part sur un phoneVerified périmé et affiche une fausse erreur.
          if (parsed.token) {
            try {
              const me = await api.users.me(parsed.token);
              const updated: AuthUser = {
                ...(parsed.user || {}),
                id: me.id ?? parsed.user?.id,
                phone: me.phone ?? parsed.user?.phone,
                role: me.role ?? parsed.user?.role,
                isVerified: me.isVerified,
                phoneVerified: me.phoneVerified,
                kycRejectedAt: me.kycRejectedAt ?? null,
                kycRejectReason: me.kycRejectReason ?? null,
                subscriptionRefundPending: !!me.subscriptionRefundPending,
                firstName: me.firstName,
                lastName: me.lastName,
                email: me.email,
                subscriptionStatus: me.subscriptionStatus,
                subscriptionExpiry: me.subscriptionExpiry,
                referralCode: me.referralCode,
                credit: me.credit,
                isAvailable: me.isAvailable,
                rating: me.rating,
                totalRatings: me.totalRatings,
                avatarUrl: me.avatarUrl,
                vehicleType: me.vehicleType,
                vehicle: me.vehicle ?? null,
                zone: me.zone,
                address: me.address,
                country: me.country,
                businessName: me.businessName,
                businessAddress: me.businessAddress,
                merchantChannels: me.merchantChannels,
                serviceCategories: me.serviceCategories,
                demarchesServiceFee: me.demarchesServiceFee,
              };
              setUser(updated);
              if (typeof me.isAvailable === 'boolean') setOnline(me.isAvailable);
              await persist(parsed.token, updated);
            } catch (e: any) {
              // Token invalide / expiré → session nettoyée
              if (e?.statusCode === 401) {
                setToken(null);
                setUser(null);
                await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
              } else {
                console.error('AuthContext bootstrap refresh error:', e);
              }
            }
          }
        }
      } catch (e) {
        console.error('AuthContext load error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = async (newToken: string, newUser: AuthUser) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }));
    } catch (e) {
      console.error('AuthContext persist error:', e);
    }
  };

  const login = useCallback(async (identifier: string, password: string, role?: 'client' | 'provider' | 'merchant', remember = true) => {
    const res = await api.auth.login(identifier, password, role);
    const me = await api.users.me(res.accessToken);
    const fullUser = { ...res.user, isVerified: me.isVerified, phoneVerified: me.phoneVerified, kycRejectedAt: me.kycRejectedAt ?? null, kycRejectReason: me.kycRejectReason ?? null, subscriptionRefundPending: !!me.subscriptionRefundPending, firstName: me.firstName, lastName: me.lastName, email: me.email, subscriptionStatus: me.subscriptionStatus, subscriptionExpiry: me.subscriptionExpiry, referralCode: me.referralCode, credit: me.credit, isAvailable: me.isAvailable, rating: me.rating, totalRatings: me.totalRatings, avatarUrl: me.avatarUrl, vehicleType: me.vehicleType, vehicle: me.vehicle ?? null, zone: me.zone, address: me.address, country: me.country, businessName: me.businessName, businessAddress: me.businessAddress, merchantChannels: me.merchantChannels, serviceCategories: me.serviceCategories, demarchesServiceFee: me.demarchesServiceFee };
    setToken(res.accessToken);
    setUser(fullUser);
    if (typeof me.isAvailable === 'boolean') setOnline(me.isAvailable);
    if (remember) {
      await persist(res.accessToken, fullUser);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, []);

  const register = useCallback(async (data: {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    role: string;
    email?: string;
    address?: string;
    country?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehiclePhotoUrl?: string;
    idCardUrl?: string;
    idCardBackUrl?: string;
    licenseUrl?: string;
    avatarUrl?: string;
    zone?: string;
    serviceCategories?: string;
    demarchesServiceFee?: number;
    businessName?: string;
    businessAddress?: string;
    merchantChannels?: string[];
    referredBy?: string;
  }) => {
    const res = await api.auth.register(data);
    const me = await api.users.me(res.accessToken);
    const fullUser = { ...res.user, isVerified: me.isVerified, phoneVerified: me.phoneVerified, kycRejectedAt: me.kycRejectedAt ?? null, kycRejectReason: me.kycRejectReason ?? null, subscriptionRefundPending: !!me.subscriptionRefundPending, firstName: me.firstName, lastName: me.lastName, email: me.email, subscriptionStatus: me.subscriptionStatus, subscriptionExpiry: me.subscriptionExpiry, referralCode: me.referralCode, credit: me.credit, isAvailable: me.isAvailable, rating: me.rating, totalRatings: me.totalRatings, avatarUrl: me.avatarUrl, vehicleType: me.vehicleType, vehicle: me.vehicle ?? null, zone: me.zone, address: me.address, country: me.country, businessName: me.businessName, businessAddress: me.businessAddress, merchantChannels: me.merchantChannels, serviceCategories: me.serviceCategories, demarchesServiceFee: me.demarchesServiceFee };
    setToken(res.accessToken);
    setUser(fullUser);
    if (res.otp?.sent) {
      setPendingOtp({
        sent: true,
        channel: res.otp.channel,
        destination: res.otp.destination,
        devCode: res.otp.devCode,
      });
    } else {
      setPendingOtp(null);
    }
    if (typeof me.isAvailable === 'boolean') setOnline(me.isAvailable);
    await persist(res.accessToken, fullUser);
  }, []);

  const handleSetOnline = useCallback((value: boolean) => {
    setOnline(value);
    if (token && user?.role === 'provider') {
      api.users.setAvailability(value, token).catch((e) => console.error('setAvailability error:', e));
    }
  }, [token, user]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPendingOtp(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    if (!token) throw new Error('Non connecté');
    await api.users.deleteMe(password, token);
    logout();
  }, [token, logout]);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    if (!token) return null;
    try {
      const me = await api.users.me(token);
      const updated: AuthUser = {
        id: me.id,
        phone: me.phone,
        role: me.role,
        isVerified: me.isVerified,
        phoneVerified: me.phoneVerified,
        kycRejectedAt: me.kycRejectedAt ?? null,
        kycRejectReason: me.kycRejectReason ?? null,
        subscriptionRefundPending: !!me.subscriptionRefundPending,
        firstName: me.firstName,
        lastName: me.lastName,
        email: me.email,
        subscriptionStatus: me.subscriptionStatus,
        subscriptionExpiry: me.subscriptionExpiry,
        referralCode: me.referralCode,
        credit: me.credit,
        isAvailable: me.isAvailable,
        rating: me.rating,
        totalRatings: me.totalRatings,
        avatarUrl: me.avatarUrl,
        vehicleType: me.vehicleType,
        vehicle: me.vehicle ?? null,
        zone: me.zone,
        address: me.address,
        country: me.country,
        businessName: me.businessName,
        businessAddress: me.businessAddress,
        merchantChannels: me.merchantChannels,
        serviceCategories: me.serviceCategories,
        demarchesServiceFee: me.demarchesServiceFee,
      };
      setUser((prev) => ({ ...(prev || {}), ...updated }));
      persist(token, { ...(user || {}), ...updated } as AuthUser).catch(() => {});
      if (typeof me.isAvailable === 'boolean') setOnline(me.isAvailable);
      return updated;
    } catch (e) {
      console.error('refreshUser error:', e);
      return null;
    }
  }, [token, user]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, online, setOnline: handleSetOnline, login, register, logout, deleteAccount, refreshUser, pendingOtp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
