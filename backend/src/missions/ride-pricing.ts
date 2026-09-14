/**
 * Grille Course personnes (Dakar MVP) — séparée de la livraison colis.
 * prix = max(minFare, baseFare + distanceKm * perKm) → arrondi supérieur 100 F.
 * Pas de multiplicateur formule (Groupé/Express) en Phase 1.
 */
export type RideVehicleTariff = {
  minFare: number;
  baseFare: number;
  perKm: number;
};

export const DAKAR_RIDE_TARIFFS: Record<'moto' | 'voiture', RideVehicleTariff> = {
  // Course personne moto (accès / court trajet)
  moto: { minFare: 400, baseFare: 300, perKm: 150 },
  // Course personne voiture
  voiture: { minFare: 1000, baseFare: 600, perKm: 220 },
};

export function resolveRideTariff(vehicleMode?: string | null): RideVehicleTariff {
  if (vehicleMode === 'voiture') return DAKAR_RIDE_TARIFFS.voiture;
  return DAKAR_RIDE_TARIFFS.moto;
}

export function computeRideFare(distanceKm: number, vehicleMode?: string | null): number {
  const tariff = resolveRideTariff(vehicleMode);
  const km = Math.max(0, Number(distanceKm) || 0);
  const raw = tariff.baseFare + km * tariff.perKm;
  return Math.max(tariff.minFare, raw);
}

export function roundUpRideFare(amount: number, factor = 100): number {
  if (amount <= 0) return 0;
  const f = Math.max(1, factor);
  return Math.ceil(amount / f) * f;
}

/** ETA course urbaine (min). */
export function estimateRideDurationMin(distanceKm: number): number {
  const avgSpeedKmh = 28;
  return Math.max(5, Math.ceil((Math.max(0, distanceKm) / avgSpeedKmh) * 60));
}
