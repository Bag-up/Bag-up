/** Formules livraison V1 — Standard = référence, Express +50 %, Groupé −20 %. */
export type DeliveryFormula = 'standard' | 'express' | 'programme' | 'groupe' | 'prioritaire';

export const FORMULA_LABELS: Record<string, string> = {
  groupe: 'Groupé',
  standard: 'Standard',
  express: 'Express',
  programme: 'Programmé',
  prioritaire: 'Prioritaire', // legacy
};

export function normalizeFormula(urgency: string): DeliveryFormula {
  if (urgency === 'prioritaire') return 'standard';
  if (['groupe', 'standard', 'express', 'programme'].includes(urgency)) {
    return urgency as DeliveryFormula;
  }
  return 'standard';
}
