import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryFormula, normalizeFormula } from './formula.types';
import {
  applyFormulaMultiplier,
  computeDistanceFare,
  resolveVehicleTariff,
  roundUpFare,
} from '../missions/pricing';
import {
  computeRideFare,
  estimateRideDurationMin,
  resolveRideTariff,
  roundUpRideFare,
} from '../missions/ride-pricing';

export interface LatLng {
  lat: number;
  lng: number;
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly prisma: PrismaService) {}

  haversineDistance(a: LatLng, b: LatLng): number {
    const R = 6371;
    const dLat = this.toRad(b.lat - a.lat);
    const dLng = this.toRad(b.lng - a.lng);
    const lat1 = this.toRad(a.lat);
    const lat2 = this.toRad(b.lat);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
  }

  /**
   * Distance routière (OSRM) avec repli haversine.
   * Aligné sur le flux type Yango : prix basé sur l'itinéraire carte.
   */
  async routeDistance(
    a: LatLng,
    b: LatLng,
  ): Promise<{ distanceKm: number; durationMin: number; source: 'route' | 'straight' }> {
    const straightKm = this.haversineDistance(a, b);
    try {
      const base = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
      const url =
        `${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}` +
        '?overview=false&alternatives=false';
      const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) {
        return {
          distanceKm: straightKm,
          durationMin: this.estimateDuration(straightKm, 'standard'),
          source: 'straight',
        };
      }
      const data = (await res.json()) as {
        routes?: Array<{ distance?: number; duration?: number }>;
      };
      const route = data?.routes?.[0];
      if (!route?.distance) {
        return {
          distanceKm: straightKm,
          durationMin: this.estimateDuration(straightKm, 'standard'),
          source: 'straight',
        };
      }
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
      const durationMin = Math.max(1, Math.ceil((route.duration || 0) / 60));
      return { distanceKm, durationMin, source: 'route' };
    } catch (err) {
      this.logger.warn(`OSRM unavailable, fallback haversine: ${String(err)}`);
      return {
        distanceKm: straightKm,
        durationMin: this.estimateDuration(straightKm, 'standard'),
        source: 'straight',
      };
    }
  }

  private async getFormulaMultipliers() {
    const tariff = await this.prisma.tariff.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      express: tariff?.expressMultiplier ?? 1.5,
      groupe: (tariff as { groupeMultiplier?: number } | null)?.groupeMultiplier ?? 0.8,
      programme: tariff?.programmeMultiplier ?? 0.9,
      prioritaire:
        (tariff as { prioritaireMultiplier?: number } | null)?.prioritaireMultiplier ?? 1.25,
      standard: 1,
      roundingFactor:
        tariff?.roundingFactor && tariff.roundingFactor > 0 ? tariff.roundingFactor : 100,
    };
  }

  /**
   * Prix Bag'up (inspiration Yango) :
   * max(min, base + km×tarif) → × formule → arrondi supérieur.
   */
  async estimatePrice(
    distanceKm: number,
    urgency: DeliveryFormula | string,
    vehicleMode?: string | null,
  ): Promise<number> {
    const formula = normalizeFormula(urgency);
    const multipliers = await this.getFormulaMultipliers();
    const distanceFare = computeDistanceFare(distanceKm, vehicleMode);
    const withFormula = applyFormulaMultiplier(distanceFare, formula, multipliers);
    return roundUpFare(withFormula, multipliers.roundingFactor);
  }

  estimateDuration(distanceKm: number, urgency: DeliveryFormula | string): number {
    const formula = normalizeFormula(urgency);
    const avgSpeed = formula === 'express' ? 45 : 30;
    return Math.ceil((distanceKm / avgSpeed) * 60);
  }

  deliveryWindow(urgency: DeliveryFormula | string): string {
    const formula = normalizeFormula(urgency);
    if (formula === 'groupe') return '3-5 jours';
    if (formula === 'express') return 'Sous 30 min - 2 h';
    if (formula === 'programme') return 'Selon créneau choisi';
    return '24-48 h';
  }

  vehicleTariff(vehicleMode?: string | null) {
    return resolveVehicleTariff(vehicleMode);
  }

  /** Prix course personnes (grille séparée de la livraison). */
  estimateRidePrice(distanceKm: number, vehicleMode?: string | null): number {
    return roundUpRideFare(computeRideFare(distanceKm, vehicleMode));
  }

  rideTariff(vehicleMode?: string | null) {
    return resolveRideTariff(vehicleMode);
  }

  estimateRideDuration(distanceKm: number): number {
    return estimateRideDurationMin(distanceKm);
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /** Autocomplete Google (rues, POI, villes) — la clé reste côté serveur. */
  async autocompletePlaces(input: string, country = 'sn', sessionToken?: string) {
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    const q = input.trim();
    if (!key || q.length < 2) return [];

    const params = new URLSearchParams({
      input: q,
      key,
      language: 'fr',
      components: `country:${country || 'sn'}`,
      // Priorité Dakar, sans exclure le reste du Sénégal.
      location: '14.7167,-17.4677',
      radius: '60000',
    });
    if (sessionToken) params.set('sessiontoken', sessionToken);

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
      { signal: AbortSignal.timeout(6000) },
    );
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.logger.warn(`Places autocomplete: ${data.status} ${data.error_message || ''}`);
      return [];
    }
    return (data.predictions || []).slice(0, 8).map((p: any) => ({
      placeId: p.place_id as string,
      label: (p.structured_formatting?.main_text || p.description || '') as string,
      subtitle: (p.structured_formatting?.secondary_text || '') as string,
    }));
  }

  async placeDetails(placeId: string, sessionToken?: string) {
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key || !placeId) return null;

    const params = new URLSearchParams({
      place_id: placeId,
      key,
      language: 'fr',
      fields: 'geometry,formatted_address,name,address_component',
    });
    if (sessionToken) params.set('sessiontoken', sessionToken);

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
      { signal: AbortSignal.timeout(6000) },
    );
    const data = await res.json();
    if (data.status !== 'OK' || !data.result?.geometry?.location) {
      this.logger.warn(`Places details: ${data.status} ${data.error_message || ''}`);
      return null;
    }

    const result = data.result;
    const components: Array<{ long_name: string; types: string[] }> =
      result.address_components || [];
    const find = (type: string) =>
      components.find((c) => c.types.includes(type))?.long_name || '';

    return {
      label: result.name || result.formatted_address || '',
      address: result.formatted_address || result.name || '',
      city:
        find('locality') ||
        find('administrative_area_level_2') ||
        find('administrative_area_level_1') ||
        'Dakar',
      country: find('country') || 'Sénégal',
      lat: result.geometry.location.lat as number,
      lng: result.geometry.location.lng as number,
    };
  }
}
