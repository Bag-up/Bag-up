export type VehicleMode = 'moto' | 'voiture';
export type ProviderVehicleType = VehicleMode | 'velo';

export const VEHICLE_MODE_SERVICES = new Set([
  'colis',
  'courses',
  'objets_personnels',
  'collecte_marchandises',
  'livraison_entreprise',
  'marchandises',
  'documents',
]);

export const VEHICLE_COLORS = [
  'Blanc',
  'Noir',
  'Gris',
  'Rouge',
  'Bleu',
  'Vert',
  'Jaune',
  'Marron',
  'Orange',
  'Autre',
] as const;

/** Couleurs affichées au client (reconnaissance type Yango). */
export const VEHICLE_COLOR_HEX: Record<string, string> = {
  Blanc: '#F3F4F6',
  Noir: '#111827',
  Gris: '#9CA3AF',
  Rouge: '#EF4444',
  Bleu: '#3B82F6',
  Vert: '#10B981',
  Jaune: '#F59E0B',
  Marron: '#92400E',
  Orange: '#F97316',
  Autre: '#6B7280',
};

export function vehicleColorHex(color?: string | null): string {
  if (!color) return VEHICLE_COLOR_HEX.Autre;
  return VEHICLE_COLOR_HEX[color] || VEHICLE_COLOR_HEX.Autre;
}

export function requiresVehicleMode(serviceType: string): boolean {
  return VEHICLE_MODE_SERVICES.has(serviceType);
}

export function vehicleModeLabel(mode?: string | null): string {
  if (mode === 'moto') return 'Moto';
  if (mode === 'voiture') return 'Voiture';
  if (mode === 'velo') return 'Vélo';
  if (mode === 'marche') return 'Marche';
  return '';
}

export function vehicleIdentityLine(opts: {
  color?: string | null;
  brand?: string | null;
  model?: string | null;
  plate?: string | null;
}) {
  const car = [opts.color, opts.brand, opts.model]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' ');
  const plate = opts.plate ? String(opts.plate).trim().toUpperCase() : '';
  return [car, plate].filter(Boolean).join(' · ');
}

export function vehicleTypeIcon(mode?: string | null): 'car' | 'bicycle' | 'walk' {
  if (mode === 'voiture') return 'car';
  if (mode === 'velo' || mode === 'marche') return 'walk';
  return 'bicycle';
}

/** Soft Senegal plate check: letters/digits/dashes/spaces, 5–20 chars. */
export function isPlausiblePlate(plate: string): boolean {
  const cleaned = plate.trim().toUpperCase().replace(/\s+/g, ' ');
  if (cleaned.length < 5 || cleaned.length > 20) return false;
  return /^[A-Z0-9][A-Z0-9\- ]+[A-Z0-9]$/i.test(cleaned);
}

/** Infos minimales pour qu’un client reconnaisse le chauffeur (style Yango). */
export function missingRideIdentityFields(user?: {
  avatarUrl?: string | null;
  vehicleType?: string | null;
  vehicle?: {
    type?: string | null;
    plate?: string | null;
    color?: string | null;
    brand?: string | null;
  } | null;
} | null): string[] {
  const missing: string[] = [];
  if (!user?.avatarUrl) missing.push('votre photo de profil');
  const type = user?.vehicle?.type || user?.vehicleType;
  if (type !== 'moto' && type !== 'voiture') {
    missing.push('un véhicule moto ou voiture (les courses ne se font pas à pied)');
    return missing;
  }
  if (!user?.vehicle?.plate || !isPlausiblePlate(user.vehicle.plate)) {
    missing.push('la plaque d’immatriculation');
  }
  if (!user?.vehicle?.color?.trim()) missing.push('la couleur du véhicule');
  return missing;
}
