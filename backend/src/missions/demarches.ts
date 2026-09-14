export const DEMARCHES_COMMISSION_RATE = 0.15;
export const DEMARCHES_SUBSCRIPTION_FCFA = 4000;

export function isDemarchesProvider(user?: {
  serviceCategories?: string | null;
  vehicleType?: string | null;
} | null) {
  if (!user) return false;
  const cats = (user.serviceCategories || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return cats.includes('demarches_admin') && !user.vehicleType;
}

export function isDemarchesMission(serviceType?: string | null) {
  return serviceType === 'depot_administratif';
}

export function providerNetFromServiceFee(serviceFee: number) {
  return Math.round(serviceFee * (1 - DEMARCHES_COMMISSION_RATE));
}
