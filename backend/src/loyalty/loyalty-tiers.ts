export type LoyaltyTierKey = 'ivoire' | 'elan' | 'genius' | 'silver' | 'gold';

export interface LoyaltyTierDef {
  level: number;
  key: LoyaltyTierKey;
  name: string;
  minCompleted: number;
  voucherAmount: number;
  antigaspiGift: boolean;
  monthly: boolean;
  perks: string[];
}

/** Plafond d'un panier Anti-Gaspi offert (Bag'up paie le commerçant). */
export const ANTIGASPI_GIFT_MAX_XOF = 3000;
export const VOUCHER_VALIDITY_DAYS = 30;

export const LOYALTY_TIERS: LoyaltyTierDef[] = [
  {
    level: 1,
    key: 'ivoire',
    name: 'Ivoire',
    minCompleted: 0,
    voucherAmount: 0,
    antigaspiGift: false,
    monthly: false,
    perks: ['Accès aux offres exclusives', 'Suivi de progression'],
  },
  {
    level: 2,
    key: 'elan',
    name: 'Élan',
    minCompleted: 10,
    voucherAmount: 1000,
    antigaspiGift: true,
    monthly: false,
    perks: ['Bon de 1 000 FCFA', 'Panier Anti-Gaspi offert', 'Livraison prioritaire'],
  },
  {
    level: 3,
    key: 'genius',
    name: 'Genius',
    minCompleted: 25,
    voucherAmount: 1500,
    antigaspiGift: true,
    monthly: false,
    perks: ['Bon de 1 500 FCFA', 'Panier Anti-Gaspi offert', 'Livraison express'],
  },
  {
    level: 4,
    key: 'silver',
    name: 'Silver',
    minCompleted: 50,
    voucherAmount: 2000,
    antigaspiGift: true,
    monthly: false,
    perks: ['Bon de 2 000 FCFA', 'Panier Anti-Gaspi offert', 'Accès événements'],
  },
  {
    level: 5,
    key: 'gold',
    name: 'Gold',
    minCompleted: 100,
    voucherAmount: 2500,
    antigaspiGift: true,
    monthly: true,
    perks: [
      'Bon de 2 500 FCFA chaque mois',
      'Panier Anti-Gaspi offert chaque mois',
      'Avantages VIP',
    ],
  },
];

export function tierForCount(count: number): LoyaltyTierDef {
  let current = LOYALTY_TIERS[0];
  for (const tier of LOYALTY_TIERS) {
    if (count >= tier.minCompleted) current = tier;
  }
  return current;
}

export function nextTier(level: number): LoyaltyTierDef | null {
  return LOYALTY_TIERS.find((t) => t.level === level + 1) ?? null;
}

export function currentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
