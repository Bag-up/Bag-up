const API_URL = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('admin_token')
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers })
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    // Token périmé ou accès refusé: nettoyer la session et revenir au login
    if ((res.status === 401 || res.status === 403) && !endpoint.startsWith('/auth/') && !endpoint.includes('/password')) {
      localStorage.removeItem('admin_token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (typeof data?.message === 'object' ? data?.message?.message : data?.message)
    throw new Error(msg || 'Erreur serveur')
  }
  return data as T
}

export const api = {
  auth: {
    login: (phone: string, password: string) =>
      request<{ accessToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      }),
    loginWithEmail: (email: string, password: string) =>
      request<{ accessToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },
  users: {
    me: () => request('/users/me'),
    updateMe: (data: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      country?: string
      address?: string
      avatarUrl?: string
    }) => request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
    all: () => request('/users/all'),
    providers: () => request('/users/providers'),
    byId: (id: string) => request(`/users/${id}`),
    create: (data: {
      firstName: string
      lastName: string
      phone: string
      password: string
      role: 'admin' | 'client' | 'provider' | 'merchant'
      email?: string
    }) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    verify: (id: string) => request(`/users/${id}/verify`, { method: 'PATCH' }),
    rejectVerification: (id: string, reason?: string) =>
      request(`/users/${id}/reject-verification`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    markSubscriptionRefunded: (id: string) =>
      request(`/users/${id}/mark-subscription-refunded`, { method: 'PATCH' }),
    changeMyPassword: (currentPassword: string, newPassword: string) =>
      request('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    resetPassword: (id: string, newPassword: string) =>
      request(`/users/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      }),
    referrals: () => request('/users/referrals/all'),
    zoneStats: () => request('/users/zones/stats'),
  },
  loyalty: {
    admin: () => request('/loyalty/admin'),
  },
  missions: {
    all: () => request('/missions'),
    byId: (id: string) => request(`/missions/${id}`),
    stats: () => request('/missions/stats'),
    updateStatus: (id: string, status: string) =>
      request(`/missions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    reimburseAdminFee: (id: string) =>
      request(`/missions/${id}/admin-fee/reimburse`, { method: 'PATCH' }),
    adminPayouts: () => request('/missions/admin/payouts'),
    adminMarkPaidOut: (id: string) =>
      request(`/missions/admin/${id}/payout`, { method: 'PATCH' }),
  },
  rides: {
    all: () => request('/rides'),
    byId: (id: string) => request(`/rides/${id}`),
  },
  payments: {
    all: () => request('/payments/all'),
  },
  subscriptions: {
    all: () => request('/subscriptions/all'),
    stats: () => request('/subscriptions/stats'),
    active: () => request('/subscriptions/active'),
    unpaidVerified: () => request('/subscriptions/unpaid-verified'),
  },
  ratings: {
    byUser: (userId: string) => request(`/ratings/user/${userId}`),
  },
  adminProcedures: {
    all: () => request('/admin-procedures/all'),
    create: (data: { name: string; category: string; organism: string; intervention: string; estimatedFee?: number; estimatedDelay?: string; isActive?: boolean }) =>
      request('/admin-procedures', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; category?: string; organism?: string; intervention?: string; estimatedFee?: number; estimatedDelay?: string; isActive?: boolean }) =>
      request(`/admin-procedures/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/admin-procedures/${id}`, { method: 'DELETE' }),
  },
  disputes: {
    all: () => request('/disputes'),
    update: (id: string, data: { status?: string; decision?: string; adminNotes?: string }) =>
      request(`/disputes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  tariffs: {
    all: () => request('/tariffs/all'),
    active: () => request('/tariffs/active'),
    create: (data: { baseFare: number; perKm: number; expressMultiplier: number; groupeMultiplier?: number; prioritaireMultiplier?: number; programmeMultiplier: number; roundingFactor: number }) =>
      request('/tariffs', { method: 'POST', body: JSON.stringify(data) }),
    activate: (id: string) => request(`/tariffs/${id}/activate`, { method: 'PATCH' }),
    insurance: () => request('/tariffs/insurance'),
    createInsurance: (data: { partnerName: string; partnerContact: string; coveragePlafond: number; eligibilityMonths: number; sinistreProcedure: string }) =>
      request('/tariffs/insurance', { method: 'POST', body: JSON.stringify(data) }),
  },
  antiGaspi: {
    settings: () => request('/anti-gaspi/settings'),
    updateSettings: (data: {
      commissionRate?: number
      basketExpiryMinutes?: number
      paymentTimeoutMinutes?: number
      maxActiveBaskets?: number
      refundPolicy?: string
    }) => request('/anti-gaspi/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    adminStats: () => request('/anti-gaspi/admin/stats'),
    adminMerchantOverview: (merchantId: string) =>
      request(`/anti-gaspi/admin/merchants/${merchantId}/overview`),
    adminPayouts: () => request('/anti-gaspi/admin/payouts'),
    adminBaskets: () => request('/anti-gaspi/admin/baskets'),
    adminReservations: () => request('/anti-gaspi/admin/reservations'),
  },
  content: {
    adminPromos: () => request('/content/admin/promos'),
    createPromo: (data: any) => request('/content/admin/promos', { method: 'POST', body: JSON.stringify(data) }),
    updatePromo: (id: string, data: any) => request(`/content/admin/promos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removePromo: (id: string) => request(`/content/admin/promos/${id}`, { method: 'DELETE' }),
    adminHomeBanners: () => request('/content/admin/home-banners'),
    createHomeBanner: (data: any) => request('/content/admin/home-banners', { method: 'POST', body: JSON.stringify(data) }),
    updateHomeBanner: (id: string, data: any) => request(`/content/admin/home-banners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removeHomeBanner: (id: string) => request(`/content/admin/home-banners/${id}`, { method: 'DELETE' }),
  },
  marketplace: {
    adminOrders: (status?: string) =>
      request(`/marketplace/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    adminAssign: (orderId: string, providerId: string) =>
      request(`/marketplace/admin/orders/${orderId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ providerId }),
      }),
    adminPayouts: () => request('/marketplace/admin/payouts'),
    adminMarkPaidOut: (orderId: string) =>
      request(`/marketplace/admin/orders/${orderId}/payout`, { method: 'PATCH' }),
  },
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function setAdminUser(user: any) {
  localStorage.setItem('admin_user', JSON.stringify(user || {}))
}

export function getAdminUser(): {
  id?: string
  phone?: string
  email?: string
  firstName?: string
  lastName?: string
  role?: string
} | null {
  try {
    const raw = localStorage.getItem('admin_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getAdminRole(): string | null {
  return getAdminUser()?.role || null
}

export function clearToken() {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
}
