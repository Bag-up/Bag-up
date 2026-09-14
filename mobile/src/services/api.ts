// Configurable via la variable d'environnement EXPO_PUBLIC_API_URL.
// Valeur de repli pour le développement local.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://admin.bagup.app/api';

/** Origine publique (sans /api) pour servir les fichiers /uploads. */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/**
 * picsum.photos renvoie une redirection (Fastly). React Native Image échoue souvent dessus.
 * On mappe les seeds marketplace connus vers l’URL directe CDN.
 */
const PICSUM_DIRECT: Record<string, string> = {
  'https://picsum.photos/seed/waxbaga/800/800':
    'https://fastly.picsum.photos/id/114/800/800.jpg?hmac=hINLjYr4jsxqzuraxplIKxmF-E26CyLVM_uCky-iE3M',
  'https://picsum.photos/seed/waxbagb/800/800':
    'https://fastly.picsum.photos/id/215/800/800.jpg?hmac=wmSax7YfZTHVZvpD9RIWChQJZZ7FGWHNkhAGnD65lss',
  'https://picsum.photos/seed/waxbagc/800/800':
    'https://fastly.picsum.photos/id/31/800/800.jpg?hmac=GYJai6iFOA5NzsHe80nMnb8spjbK0dKr_LRg2DPKn1Q',
  'https://picsum.photos/seed/waxbagd/800/800':
    'https://fastly.picsum.photos/id/642/800/800.jpg?hmac=jIrUlJJA8ZPkiDMznIloNJkMhfalsAWvw7Hno84exiY',
  'https://picsum.photos/seed/cauria/800/800':
    'https://fastly.picsum.photos/id/376/800/800.jpg?hmac=ADUb0HOVSZM1xI-hH8RPuLVPhLDb5kvpeor_V7gSKJM',
  'https://picsum.photos/seed/caurib/800/800':
    'https://fastly.picsum.photos/id/974/800/800.jpg?hmac=qMLS4RfFZPy-gVIGLWAmOPTeG5MfrffW4mXtsH3_cR0',
  'https://picsum.photos/seed/cauric/800/800':
    'https://fastly.picsum.photos/id/935/800/800.jpg?hmac=ogwrzknFLiYJ_4E9O5GfXYnQtMixbzcrIsNmIPm9WVk',
  'https://picsum.photos/seed/caurid/800/800':
    'https://fastly.picsum.photos/id/288/800/800.jpg?hmac=N6o3in0crhqfYLds7mE5VjECUtSelyrR6W20HDRw_PE',
  'https://picsum.photos/seed/bouboua/800/800':
    'https://fastly.picsum.photos/id/916/800/800.jpg?hmac=bGX1ANR8PkrQr7Vo5dpryzah37iHQEYHqLXXfm9Jgqk',
  'https://picsum.photos/seed/bouboub/800/800':
    'https://fastly.picsum.photos/id/600/800/800.jpg?hmac=i2rFYbVQjSQPxrUfwctLI1RScA02W8TxbxgDyZ5AxSs',
  'https://picsum.photos/seed/boubouc/800/800':
    'https://fastly.picsum.photos/id/301/800/800.jpg?hmac=Fwx10S0oyeQ7YBWUhVHlDckUSSupic3Awz0EZCSquRM',
  'https://picsum.photos/seed/bouboud/800/800':
    'https://fastly.picsum.photos/id/999/800/800.jpg?hmac=rZrOJFKcyKk9VlHsLhCrsSUV-YR5kjmjpbJBXazcrw8',
  'https://picsum.photos/seed/batika/800/800':
    'https://fastly.picsum.photos/id/290/800/800.jpg?hmac=gnqz8JHDRYKRM6uLIpwjZm79NNAXUtsXBuokO2BiRJU',
  'https://picsum.photos/seed/batikb/800/800':
    'https://fastly.picsum.photos/id/986/800/800.jpg?hmac=wrIwsMUoGYNsq1Nl8BW8ummk6pwamImaSxXG7GQDO4E',
  'https://picsum.photos/seed/batikc/800/800':
    'https://fastly.picsum.photos/id/783/800/800.jpg?hmac=bZ7Fx_ZE9nU0jHQPem07lpx9ITPNBWs7aq-bVbh-XM0',
  'https://picsum.photos/seed/batikd/800/800':
    'https://fastly.picsum.photos/id/1081/800/800.jpg?hmac=W3maXQFeafbzQkrQqpDFPzpcWQ3uprm5MRww97oOvzs',
  'https://picsum.photos/seed/modelogo/200/200':
    'https://fastly.picsum.photos/id/667/200/200.jpg?hmac=Dqc51PnEPXpiiStRcDoPxytal0MOGvzg-eDZ4BsVIz8',
  'https://picsum.photos/seed/modecover/1200/600':
    'https://fastly.picsum.photos/id/60/1200/600.jpg?hmac=Gqt4DNquanfpbl6zPCQyf8V5fEf4YtAfLkCBq3gsiZE',
};

/**
 * Réécrit les URLs média cassées hors LAN (localhost, IP VPS, chemins relatifs)
 * pour pointer vers le serveur API public.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/')) return `${API_ORIGIN}${trimmed}`;

  const picsumDirect = PICSUM_DIRECT[trimmed.replace(/\/$/, '')];
  if (picsumDirect) return picsumDirect;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const needsRewrite =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '72.62.234.114' ||
      host.endsWith('.sslip.io') ||
      host.endsWith('.nip.io');
    if (needsRewrite) {
      const origin = new URL(API_ORIGIN);
      parsed.protocol = origin.protocol;
      parsed.host = origin.host;
      return parsed.toString();
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

export function resolveMediaUrls(urls?: (string | null | undefined)[] | null): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.map((u) => resolveMediaUrl(u)).filter((u): u is string => !!u);
}

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

// Résultat renvoyé par les endpoints `initiate` (paiements et abonnements).
export interface ChargeInitResult {
  provider: string;
  providerRef?: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  redirectUrl?: string;
  link?: string;
  qrCode?: string;
  message?: string;
  paymentId?: string;
  subscriptionId?: string;
  reservationId?: string;
  transactionId?: string;
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${API_URL}${endpoint}`;
  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    res = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (e: any) {
    const aborted = e?.name === 'AbortError';
    const hint =
      typeof API_URL === 'string' && API_URL.startsWith('http://')
        ? ` Impossible de joindre ${API_URL}. Vérifie Wi‑Fi / données, ou ouvre cette adresse dans Chrome sur la tablette.`
        : '';
    throw new ApiError(
      0,
      aborted
        ? 'Le serveur met trop de temps à répondre.'
        : (e?.message === 'Network request failed'
        ? `Réseau indisponible.${hint}`
        : e?.message) || 'Erreur réseau',
    );
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    let errMsg: string | undefined;
    const raw = data?.message;
    if (Array.isArray(raw)) {
      errMsg = raw.map(String).join('\n');
    } else if (raw && typeof raw === 'object') {
      errMsg = (raw as { message?: string }).message;
    } else if (typeof raw === 'string') {
      errMsg = raw;
    }
    const err = new ApiError(res.status, errMsg || `Erreur ${res.status}`);
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as any).devCode) {
      (err as any).devCode = (raw as any).devCode;
    }
    throw err;
  }
  return data as T;
}

export const api = {
  auth: {
    login: (identifier: string, password: string, role?: 'client' | 'provider' | 'merchant') =>
      request<{ accessToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(
          identifier.includes('@')
            ? { email: identifier, password, ...(role ? { role } : {}) }
            : { phone: identifier, password, ...(role ? { role } : {}) }
        ),
      }),
    discoverRoles: (identifier: string) =>
      request<{ roles: ('client' | 'provider' | 'merchant')[] }>('/auth/discover-roles', {
        method: 'POST',
        body: JSON.stringify(
          identifier.includes('@') ? { email: identifier.trim() } : { phone: identifier.trim() },
        ),
      }),
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
      businessName?: string;
      businessAddress?: string;
      merchantChannels?: string[];
      referredBy?: string;
    }) =>
      request<{
        accessToken: string;
        user: any;
        otp?: { message?: string; channel?: 'sms' | 'email'; destination?: string; sent?: boolean; devCode?: string };
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    forgotPassword: (payload: { email?: string; phone?: string; role?: string }) =>
      request<{ message: string; token?: string; devToken?: string; channel?: 'sms' | 'email' }>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
    resetPassword: (token: string, newPassword: string) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
    sendOtp: (phone: string, token?: string | null, email?: string) =>
      request<{
        message: string;
        devCode?: string;
        channel?: 'sms' | 'email';
        destination?: string;
      }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, ...(email ? { email } : {}) }),
      }, token),
    verifyOtp: (phone: string, code: string, token?: string | null) =>
      request<{ message: string }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      }, token),
    skipOtp: (phone: string, token?: string | null) =>
      request<{ message: string }>('/auth/skip-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }, token),
  },
  uploads: {
    upload: (file: { uri: string; type: string; name: string }, token?: string | null) => {
      const formData = new FormData();
      formData.append('file', file as any);
      return request<{ url: string; filename: string }>('/uploads', {
        method: 'POST',
        body: formData as any,
        headers: {},
      }, token);
    },
    publicRegistrationUpload: (file: { uri: string; type: string; name: string }) => {
      const formData = new FormData();
      formData.append('file', file as any);
      return request<{ url: string; filename: string }>('/uploads/public-registration', {
        method: 'POST',
        body: formData as any,
        headers: {},
      });
    },
  },
  users: {
    me: (token: string) => request('/users/me', {}, token),
    updateMe: (data: any, token: string) =>
      request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }, token),
    deleteMe: (password: string, token: string) =>
      request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }, token),
    myReferrals: (token: string) => request('/users/me/referrals', {}, token),
    setAvailability: (isAvailable: boolean, token: string) =>
      request('/users/me/availability', { method: 'PATCH', body: JSON.stringify({ isAvailable }) }, token),
    providers: (token: string, zone?: string) => request(`/users/providers${zone ? `?zone=${encodeURIComponent(zone)}` : ''}`, {}, token),
    demarchesProviders: (token: string, zone?: string) => request(`/users/demarches-providers${zone ? `?zone=${encodeURIComponent(zone)}` : ''}`, {}, token),
    byId: (id: string, token: string) => request(`/users/${id}`, {}, token),
    verify: (id: string, token: string) =>
      request(`/users/${id}/verify`, { method: 'PATCH' }, token),
  },
  loyalty: {
    me: (token: string) => request('/loyalty/me', {}, token),
  },
  missions: {
    create: (data: any, token: string) =>
      request('/missions', { method: 'POST', body: JSON.stringify(data) }, token),
    all: (token: string) => request('/missions', {}, token),
    available: (token: string, zone?: string, lat?: number, lng?: number, radius?: number) => {
      const params = [
        zone ? `zone=${encodeURIComponent(zone)}` : '',
        lat !== undefined ? `lat=${lat}` : '',
        lng !== undefined ? `lng=${lng}` : '',
        radius ? `radius=${radius}` : '',
      ].filter(Boolean).join('&');
      return request(`/missions/available${params ? `?${params}` : ''}`, {}, token);
    },
    mine: (token: string) => request('/missions/mine', {}, token),
    provider: (token: string) => request('/missions/provider', {}, token),
    byId: (id: string, token: string) => request(`/missions/${id}`, {}, token),
    accept: (id: string, token: string) =>
      request(`/missions/${id}/accept`, { method: 'PATCH' }, token),
    refuse: (id: string, token: string) =>
      request(`/missions/${id}/refuse`, { method: 'PATCH' }, token),
    cancel: (id: string, token: string) =>
      request(`/missions/${id}/cancel`, { method: 'PATCH' }, token),
    updateStatus: (id: string, status: string, token: string, code?: string) =>
      request(`/missions/${id}/status`, { method: 'PATCH', body: JSON.stringify(code ? { status, code } : { status }) }, token),
    updateLocation: (id: string, lat: number, lng: number, token: string) =>
      request(`/missions/${id}/location`, { method: 'PATCH', body: JSON.stringify({ lat, lng }) }, token),
    getLocation: (id: string, token: string) =>
      request(`/missions/${id}/location`, {}, token),
    submitAdminFeeReceipt: (id: string, actualFee: number, receiptUrl: string, token: string) =>
      request(`/missions/${id}/admin-fee/receipt`, { method: 'PATCH', body: JSON.stringify({ actualFee, receiptUrl }) }, token),
    reimburseAdminFee: (id: string, token: string) =>
      request(`/missions/${id}/admin-fee/reimburse`, { method: 'PATCH' }, token),
  },
  payments: {
    create: (data: any, token: string) =>
      request('/payments', { method: 'POST', body: JSON.stringify(data) }, token),
    mine: (token: string) => request('/payments', {}, token),
    byId: (id: string, token: string) => request(`/payments/${id}`, {}, token),
    markSuccess: (id: string, transactionId: string, token: string) =>
      request(`/payments/${id}/success`, { method: 'PATCH', body: JSON.stringify({ transactionId }) }, token),
    markFailed: (id: string, token: string) =>
      request(`/payments/${id}/failed`, { method: 'PATCH' }, token),
    // Lance le paiement auprès de la passerelle (Bictorys/Stripe) et renvoie
    // les infos de redirection (deep link Wave, QR, page carte, message USSD).
    initiate: (
      id: string,
      data: { otp?: string; successRedirectUrl?: string; errorRedirectUrl?: string },
      token: string,
    ) =>
      request<ChargeInitResult>(`/payments/${id}/initiate`, { method: 'POST', body: JSON.stringify(data) }, token),
  },
  geo: {
    places: (q: string, token: string, session?: string, country = 'sn') =>
      request(
        `/geo/places?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}${session ? `&session=${encodeURIComponent(session)}` : ''}`,
        {},
        token,
      ),
    placeDetails: (placeId: string, token: string, session?: string) =>
      request(
        `/geo/places/details?placeId=${encodeURIComponent(placeId)}${session ? `&session=${encodeURIComponent(session)}` : ''}`,
        {},
        token,
      ),
    distance: (lat1: string, lng1: string, lat2: string, lng2: string, token: string) =>
      request(`/geo/distance?lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}`, {}, token),
    estimateRide: (
      lat1: string,
      lng1: string,
      lat2: string,
      lng2: string,
      vehicleMode: 'moto' | 'voiture',
      token: string,
    ) =>
      request<{
        distanceKm: number;
        price: number;
        durationMin: number;
        vehicleMode: string;
        indicative?: boolean;
      }>(
        `/geo/estimate-ride?lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}&vehicleMode=${vehicleMode}`,
        {},
        token,
      ),
    estimate: (lat1: string, lng1: string, lat2: string, lng2: string, urgency: string, token: string, vehicleMode?: string) =>
      request(
        `/geo/estimate?lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}&urgency=${urgency}${vehicleMode ? `&vehicleMode=${vehicleMode}` : ''}`,
        {},
        token,
      ),
  },
  rides: {
    create: (
      data: {
        pickupAddress: string;
        dropoffAddress: string;
        vehicleMode: 'moto' | 'voiture';
        pickupLat?: string;
        pickupLng?: string;
        dropoffLat?: string;
        dropoffLng?: string;
        estimatedPrice?: number;
      },
      token: string,
    ) => request('/rides', { method: 'POST', body: JSON.stringify(data) }, token),
    available: (token: string, lat?: number, lng?: number, radius?: number) => {
      const params = [
        lat !== undefined ? `lat=${lat}` : '',
        lng !== undefined ? `lng=${lng}` : '',
        radius ? `radius=${radius}` : '',
      ]
        .filter(Boolean)
        .join('&');
      return request(`/rides/available${params ? `?${params}` : ''}`, {}, token);
    },
    mine: (token: string) => request('/rides/mine', {}, token),
    driver: (token: string) => request('/rides/driver', {}, token),
    byId: (id: string, token: string) => request(`/rides/${id}`, {}, token),
    accept: (id: string, token: string) =>
      request(`/rides/${id}/accept`, { method: 'PATCH' }, token),
    refuse: (id: string, token: string) =>
      request(`/rides/${id}/refuse`, { method: 'PATCH' }, token),
    cancel: (id: string, token: string) =>
      request(`/rides/${id}/cancel`, { method: 'PATCH' }, token),
    confirmCash: (id: string, token: string) =>
      request(`/rides/${id}/confirm-cash`, { method: 'PATCH' }, token),
    pendingCash: (token: string) => request('/rides/pending-cash', {}, token),
    updateStatus: (id: string, status: string, token: string) =>
      request(`/rides/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
    updateLocation: (id: string, lat: number, lng: number, token: string) =>
      request(`/rides/${id}/location`, { method: 'PATCH', body: JSON.stringify({ lat, lng }) }, token),
    getLocation: (id: string, token: string) =>
      request<{
        id: string;
        status: string;
        driverLat?: string | null;
        driverLng?: string | null;
        etaToPickupMin?: number | null;
        etaToDropoffMin?: number | null;
        distanceToTargetKm?: number | null;
        passengerReadyAt?: string | null;
        passengerLat?: string | null;
        passengerLng?: string | null;
      }>(`/rides/${id}/location`, {}, token),
    markReady: (id: string, token: string, coords?: { lat?: number; lng?: number }) =>
      request(`/rides/${id}/ready`, { method: 'PATCH', body: JSON.stringify(coords || {}) }, token),
  },
  messages: {
    conversations: (token: string) => request('/messages/conversations', {}, token),
    conversation: (id: string, token: string) => request(`/messages/conversation/${id}`, {}, token),
    createConversation: (data: any, token: string) =>
      request('/messages/conversation', { method: 'POST', body: JSON.stringify(data) }, token),
    send: (data: any, token: string) =>
      request('/messages', { method: 'POST', body: JSON.stringify(data) }, token),
    markRead: (conversationId: string, token: string) =>
      request(`/messages/conversation/${conversationId}/read`, { method: 'PATCH' }, token),
    delete: (messageId: string, token: string) =>
      request(`/messages/${messageId}`, { method: 'DELETE' }, token),
  },
  ratings: {
    create: (data: any, token: string) =>
      request('/ratings', { method: 'POST', body: JSON.stringify(data) }, token),
    byUser: (userId: string, token: string) => request(`/ratings/user/${userId}`, {}, token),
    byMission: (missionId: string, token: string) => request(`/ratings/mission/${missionId}`, {}, token),
    byRide: (rideId: string, token: string) => request(`/ratings/ride/${rideId}`, {}, token),
    mine: (token: string) => request('/ratings/mine', {}, token),
  },
  subscriptions: {
    create: (data: any, token: string) =>
      request('/subscriptions', { method: 'POST', body: JSON.stringify(data) }, token),
    mine: (token: string) => request('/subscriptions', {}, token),
    markSuccess: (id: string, transactionId: string, token: string) =>
      request(`/subscriptions/${id}/success`, { method: 'PATCH', body: JSON.stringify({ transactionId }) }, token),
    markFailed: (id: string, token: string) =>
      request(`/subscriptions/${id}/failed`, { method: 'PATCH' }, token),
    // Lance le paiement de l'abonnement auprès de la passerelle.
    initiate: (
      id: string,
      data: { method: string; otp?: string; successRedirectUrl?: string; errorRedirectUrl?: string },
      token: string,
    ) =>
      request<ChargeInitResult>(`/subscriptions/${id}/initiate`, { method: 'POST', body: JSON.stringify(data) }, token),
    stats: (token: string) => request('/subscriptions/stats', {}, token),
  },
  adminProcedures: {
    all: () => request('/admin-procedures'),
    byCategory: (category: string) => request(`/admin-procedures/category/${encodeURIComponent(category)}`),
  },
  disputes: {
    create: (data: { missionId: string; reason: string; description?: string; evidence?: string }, token: string) =>
      request('/disputes', { method: 'POST', body: JSON.stringify(data) }, token),
    all: (token: string) => request('/disputes', {}, token),
    mine: (token: string) => request('/disputes/mine', {}, token),
    byMission: (missionId: string, token: string) => request(`/disputes/${missionId}`, {}, token),
  },
  notifications: {
    hotline: () => request<{ phone: string; email: string }>('/notifications/hotline'),
    registerFcmToken: (fcmToken: string, token: string) =>
      request('/notifications/fcm-token', { method: 'POST', body: JSON.stringify({ token: fcmToken }) }, token),
    mine: (token: string) => request('/notifications', {}, token),
    unreadCount: (token: string) =>
      request<{ count: number }>('/notifications/unread-count', {}, token),
    markRead: (id: string, token: string) =>
      request(`/notifications/${id}/read`, { method: 'PATCH' }, token),
    markAllRead: (token: string) =>
      request('/notifications/read-all', { method: 'PATCH' }, token),
  },
  antiGaspi: {
    baskets: (token?: string | null, lat?: number, lng?: number, radiusKm?: number) => {
      const params = [
        lat !== undefined ? `lat=${lat}` : '',
        lng !== undefined ? `lng=${lng}` : '',
        radiusKm !== undefined ? `radiusKm=${radiusKm}` : '',
      ].filter(Boolean).join('&');
      return request(`/anti-gaspi/baskets${params ? `?${params}` : ''}`, {}, token);
    },
    basket: (id: string, token?: string | null) =>
      request(`/anti-gaspi/baskets/${id}`, {}, token),
    createBasket: (data: any, token: string) =>
      request('/anti-gaspi/baskets', { method: 'POST', body: JSON.stringify(data) }, token),
    updateBasket: (id: string, data: any, token: string) =>
      request(`/anti-gaspi/baskets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),
    cancelBasket: (id: string, token: string) =>
      request(`/anti-gaspi/baskets/${id}`, { method: 'DELETE' }, token),
    reserve: (basketId: string, token: string) =>
      request(`/anti-gaspi/baskets/${basketId}/reserve`, { method: 'POST' }, token),
    myReservations: (token: string) =>
      request('/anti-gaspi/reservations/me', {}, token),
    reservation: (id: string, token: string) =>
      request(`/anti-gaspi/reservations/${id}`, {}, token),
    pay: (
      id: string,
      data: { method: string; otp?: string; successRedirectUrl?: string; errorRedirectUrl?: string },
      token: string,
    ) =>
      request<ChargeInitResult>(`/anti-gaspi/reservations/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }, token),
    claimGift: (id: string, rewardId: string, token: string) =>
      request(`/anti-gaspi/reservations/${id}/claim-gift`, {
        method: 'POST',
        body: JSON.stringify({ rewardId }),
      }, token),
    confirmClient: (id: string, token: string) =>
      request(`/anti-gaspi/reservations/${id}/confirm/client`, { method: 'POST' }, token),
    confirmMerchant: (id: string, token: string) =>
      request(`/anti-gaspi/reservations/${id}/confirm/merchant`, { method: 'POST' }, token),
    merchantBaskets: (token: string) =>
      request('/anti-gaspi/merchant/baskets', {}, token),
    merchantReservations: (token: string) =>
      request('/anti-gaspi/merchant/reservations', {}, token),
    merchantPayouts: (token: string) =>
      request('/anti-gaspi/merchant/payouts', {}, token),
    merchantStats: (token: string) =>
      request('/anti-gaspi/merchant/stats', {}, token),
  },
  marketplace: {
    fx: () => request('/marketplace/fx'),
    listShops: (city?: string) =>
      request(`/marketplace/shops${city ? `?city=${encodeURIComponent(city)}` : ''}`),
    getShop: (id: string) => request(`/marketplace/shops/${id}`),
    getProduct: (id: string) => request(`/marketplace/products/${id}`),
    myShop: (token: string) => request('/marketplace/shops/me', {}, token),
    createShop: (data: any, token: string) =>
      request('/marketplace/shops', { method: 'POST', body: JSON.stringify(data) }, token),
    updateShop: (data: any, token: string) =>
      request('/marketplace/shops/me', { method: 'PATCH', body: JSON.stringify(data) }, token),
    myProducts: (token: string) => request('/marketplace/products/me', {}, token),
    createProduct: (data: any, token: string) =>
      request('/marketplace/products', { method: 'POST', body: JSON.stringify(data) }, token),
    updateProduct: (id: string, data: any, token: string) =>
      request(`/marketplace/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),
    publishProduct: (id: string, token: string) =>
      request(`/marketplace/products/${id}/publish`, { method: 'POST' }, token),
    archiveProduct: (id: string, token: string) =>
      request(`/marketplace/products/${id}/archive`, { method: 'PATCH' }, token),
    quote: (data: any, token: string) =>
      request('/marketplace/quote', { method: 'POST', body: JSON.stringify(data) }, token),
    createOrder: (data: any, token: string) =>
      request('/marketplace/orders', { method: 'POST', body: JSON.stringify(data) }, token),
    myOrders: (token: string) => request('/marketplace/orders/me', {}, token),
    shopOrders: (token: string) => request('/marketplace/orders/shop', {}, token),
    getOrder: (id: string, token: string) => request(`/marketplace/orders/${id}`, {}, token),
    markPrepared: (id: string, token: string) =>
      request(`/marketplace/orders/${id}/prepare`, { method: 'POST' }, token),
    payOrder: (id: string, data: any, token: string) =>
      request<ChargeInitResult>(`/marketplace/orders/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }, token),
  },
  content: {
    promos: () => request('/content/promos'),
    homeBanners: () => request('/content/home-banners'),
    appRelease: () =>
      request<{
        latestVersion: string;
        force?: boolean;
        message?: string;
        iosUrl?: string;
        androidUrl?: string;
      }>('/content/app-release'),
  },
};
