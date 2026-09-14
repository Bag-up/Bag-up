export type LoyaltyTierKey = 'ivoire' | 'elan' | 'genius' | 'silver' | 'gold';

export const TIER_UI: Record<
  LoyaltyTierKey,
  { icon: string; color: string; gradient: [string, string]; label: string }
> = {
  ivoire: { icon: 'diamond-outline', color: '#5A9BC8', gradient: ['#8EC5E8', '#5A9BC8'], label: 'Ivoire' },
  elan: { icon: 'flash-outline', color: '#059669', gradient: ['#34D399', '#059669'], label: 'Élan' },
  genius: { icon: 'bulb-outline', color: '#D97706', gradient: ['#FBBF24', '#D97706'], label: 'Genius' },
  silver: { icon: 'star-outline', color: '#64748B', gradient: ['#CBD5E1', '#64748B'], label: 'Silver' },
  gold: { icon: 'trophy', color: '#C9A227', gradient: ['#F5D76E', '#C9A227'], label: 'Gold' },
};

/** Résumé affiché à l’inscription / onboarding (aligné backend). */
export const LOYALTY_SIGNUP_TIERS: { key: LoyaltyTierKey; from: number; perk: string }[] = [
  { key: 'ivoire', from: 0, perk: 'Départ' },
  { key: 'elan', from: 10, perk: 'Bon 1 000 F' },
  { key: 'genius', from: 25, perk: 'Bon 1 500 F' },
  { key: 'silver', from: 50, perk: 'Bon 2 000 F' },
  { key: 'gold', from: 100, perk: 'Bon + panier / mois' },
];

export function tierUi(key?: string) {
  return TIER_UI[(key as LoyaltyTierKey) || 'ivoire'] || TIER_UI.ivoire;
}
