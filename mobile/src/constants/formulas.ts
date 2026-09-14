export const formulaOptions = [
  { id: 'groupe', label: 'Groupé', desc: 'Livraison mutualisée · 3-5 jours', icon: 'people' as const },
  { id: 'standard', label: 'Standard', desc: 'Référence · 24-48 h', icon: 'time' as const },
  { id: 'express', label: 'Express', desc: 'Priorité maximale · sous 2 h', icon: 'flash' as const },
];

export const FORMULA_LABELS: Record<string, string> = {
  groupe: 'Groupé',
  standard: 'Standard',
  express: 'Express',
  programme: 'Programmé',
  prioritaire: 'Standard',
};

export function formatFormulaLabel(urgency?: string | null): string {
  if (!urgency) return '—';
  return FORMULA_LABELS[urgency] || urgency;
}
