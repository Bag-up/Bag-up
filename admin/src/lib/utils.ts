import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFCFA(amount: number | string) {
  return Number(amount).toLocaleString('fr-FR') + ' FCFA'
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function statusColors(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-warning-soft text-warning',
    accepted: 'bg-info-soft text-info',
    picked_up: 'bg-info-soft text-info',
    in_progress: 'bg-info-soft text-info',
    delivered: 'bg-success-soft text-success',
    cancelled: 'bg-accent-soft text-accent',
    success: 'bg-success-soft text-success',
    failed: 'bg-accent-soft text-accent',
    refunded: 'bg-warning-soft text-warning',
    active: 'bg-success-soft text-success',
    expired: 'bg-accent-soft text-accent',
    suspended: 'bg-warning-soft text-warning',
    none: 'bg-gray-100 text-gray-500',
    trial: 'bg-info-soft text-info',
  }
  return map[status] || 'bg-gray-100 text-gray-500'
}
