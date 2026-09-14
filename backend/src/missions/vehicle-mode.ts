/** Services where the client must pick moto or voiture. */
export const VEHICLE_MODE_SERVICES = new Set([
  'colis',
  'courses',
  'objets_personnels',
  'collecte_marchandises',
  'livraison_entreprise',
  'marchandises',
  'documents',
]);

export type VehicleMode = 'moto' | 'voiture';

/** @deprecated Prefer DAKAR_VEHICLE_TARIFFS in pricing.ts */
export const VOITURE_PRICE_MULTIPLIER = 1.25;

export function requiresVehicleMode(serviceType: string): boolean {
  return VEHICLE_MODE_SERVICES.has(serviceType);
}

export function normalizeVehicleMode(value?: string | null): VehicleMode | null {
  if (value === 'moto' || value === 'voiture') return value;
  return null;
}

export function vehicleModeLabel(mode?: string | null): string {
  if (mode === 'moto') return 'Moto';
  if (mode === 'voiture') return 'Voiture';
  return '';
}

/** @deprecated Voiture a sa propre grille — voir pricing.ts */
export function applyVehiclePriceMultiplier(price: number, _mode?: string | null): number {
  return price;
}
