/** Montants du programme de parrainage (FCFA crédit wallet). */
export const REFERRAL_REWARD_CLIENT = 500;
export const REFERRAL_REWARD_PRO = 1000; // provider | merchant
export const REFERRAL_MONTHLY_CAP = 10;

export function rewardForReferredRole(role: string): number {
  if (role === 'provider' || role === 'merchant') return REFERRAL_REWARD_PRO;
  return REFERRAL_REWARD_CLIENT;
}

export function rewardTypeForReferredRole(role: string): string {
  if (role === 'provider' || role === 'merchant') return 'pro_1000';
  return 'client_500';
}
