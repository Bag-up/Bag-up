import { VehicleMode, normalizeVehicleMode } from './vehicle-mode';

/**
 * Grille Dakar MVP (inspiration Yango, adaptée livraison Bag'up).
 * prix = max(minFare, baseFare + distanceKm * perKm)
 * puis × formule, puis arrondi supérieur.
 */
export type VehicleTariff = {
  minFare: number;
  baseFare: number;
  perKm: number;
};

export const DAKAR_VEHICLE_TARIFFS: Record<'moto' | 'voiture' | 'default', VehicleTariff> = {
  // Accès / courses courtes
  moto: { minFare: 500, baseFare: 200, perKm: 110 },
  // Volume / capacité
  voiture: { minFare: 800, baseFare: 400, perKm: 150 },
  // Démarches / services sans choix véhicule
  default: { minFare: 500, baseFare: 250, perKm: 120 },
};

export const DEFAULT_FORMULA_MULTIPLIERS = {
  express: 1.5,
  groupe: 0.8,
  programme: 0.9,
  prioritaire: 1.25,
  standard: 1,
};

/** Arrondi Yango-like : toujours au multiple supérieur. */
export function roundUpFare(amount: number, factor = 100): number {
  if (amount <= 0) return 0;
  const f = Math.max(1, factor);
  return Math.ceil(amount / f) * f;
}

export function resolveVehicleTariff(vehicleMode?: string | null): VehicleTariff {
  const mode = normalizeVehicleMode(vehicleMode);
  if (mode === 'moto') return DAKAR_VEHICLE_TARIFFS.moto;
  if (mode === 'voiture') return DAKAR_VEHICLE_TARIFFS.voiture;
  return DAKAR_VEHICLE_TARIFFS.default;
}

/**
 * Prix de base distance (avant formule / arrondi).
 */
export function computeDistanceFare(distanceKm: number, vehicleMode?: string | null): number {
  const tariff = resolveVehicleTariff(vehicleMode);
  const km = Math.max(0, Number(distanceKm) || 0);
  const raw = tariff.baseFare + km * tariff.perKm;
  return Math.max(tariff.minFare, raw);
}

export function applyFormulaMultiplier(
  amount: number,
  urgency: string,
  multipliers?: Partial<typeof DEFAULT_FORMULA_MULTIPLIERS>,
): number {
  const m = { ...DEFAULT_FORMULA_MULTIPLIERS, ...multipliers };
  if (urgency === 'express') return amount * m.express;
  if (urgency === 'groupe') return amount * m.groupe;
  if (urgency === 'programme') return amount * m.programme;
  if (urgency === 'prioritaire') return amount * m.prioritaire;
  return amount * m.standard;
}

/** Legacy helper — la voiture a désormais sa propre grille, plus de ×1.25 global. */
export function applyVehiclePriceMultiplier(price: number, _mode?: string | null): number {
  return price;
}

export type { VehicleMode };
