export type StaffRole = 'admin' | 'assistant' | 'manager'

export type AdminNavPath =
  | '/'
  | '/users'
  | '/missions'
  | '/rides'
  | '/payments'
  | '/subscriptions'
  | '/anti-gaspi'
  | '/marketplace'
  | '/content'
  | '/disputes'
  | '/referrals'
  | '/loyalty'
  | '/tariffs'
  | '/procedures'
  | '/profile'

const ASSISTANT_PATHS: AdminNavPath[] = [
  '/',
  '/users',
  '/missions',
  '/rides',
  '/anti-gaspi',
  '/marketplace',
  '/disputes',
  '/loyalty',
  '/profile',
]

const MANAGER_EXTRA: AdminNavPath[] = [
  '/disputes',
  '/payments',
  '/subscriptions',
  '/referrals',
  '/loyalty',
]

const ALL_PATHS: AdminNavPath[] = [
  '/',
  '/users',
  '/missions',
  '/rides',
  '/payments',
  '/subscriptions',
  '/anti-gaspi',
  '/marketplace',
  '/content',
  '/disputes',
  '/referrals',
  '/loyalty',
  '/tariffs',
  '/procedures',
  '/profile',
]

export function roleLabelFr(role?: string | null): string {
  switch (role) {
    case 'assistant':
      return 'Assistante'
    case 'manager':
      return 'Gérant'
    case 'admin':
      return 'Admin'
    default:
      return 'Staff'
  }
}

export function pathsForRole(role?: string | null): AdminNavPath[] {
  if (role === 'admin') return ALL_PATHS
  if (role === 'manager') return [...ASSISTANT_PATHS, ...MANAGER_EXTRA]
  if (role === 'assistant') return ASSISTANT_PATHS
  return []
}

export function canAccessPath(role: string | null | undefined, path: string): boolean {
  const allowed = pathsForRole(role)
  if (path === '/') return allowed.includes('/')
  const base = ('/' + path.split('/').filter(Boolean)[0]) as AdminNavPath
  return allowed.includes(base)
}

/** Mutations config / comptes — admin uniquement. */
export function canAdminWrite(role?: string | null): boolean {
  return role === 'admin'
}

/** Validation KYC presta / commerçant — admin ou assistante. */
export function canVerifyAccounts(role?: string | null): boolean {
  return role === 'admin' || role === 'assistant'
}

/** Mutations opérationnelles — admin ou gérant. */
export function canManagerWrite(role?: string | null): boolean {
  return role === 'admin' || role === 'manager'
}

/** Traitement des litiges — admin, gérant ou assistante. */
export function canHandleDisputes(role?: string | null): boolean {
  return role === 'admin' || role === 'manager' || role === 'assistant'
}

export function isStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'assistant' || role === 'manager'
}
