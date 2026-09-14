/**
 * Couche d'abstraction de routing (itinéraire routier + ETA).
 *
 * Implémentation par défaut: OSRM (gratuit, sans clé API).
 * Pour basculer plus tard vers Google/Mapbox, il suffit de fournir une autre
 * implémentation de `RoutingProvider` et de l'affecter à `routing`.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** Points du tracé suivant les routes réelles. */
  coordinates: LatLng[];
  /** Distance totale en mètres. */
  distanceMeters: number;
  /** Durée estimée en secondes. */
  durationSeconds: number;
}

export interface RoutingProvider {
  getRoute(origin: LatLng, destination: LatLng, signal?: AbortSignal): Promise<RouteResult | null>;
}

/**
 * Implémentation OSRM (Open Source Routing Machine).
 * Utilise le serveur de démonstration public par défaut. Peut être pointé
 * vers une instance auto-hébergée en changeant `baseUrl`.
 */
export class OsrmRoutingProvider implements RoutingProvider {
  private baseUrl: string;

  constructor(baseUrl = 'https://router.project-osrm.org') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getRoute(origin: LatLng, destination: LatLng, signal?: AbortSignal): Promise<RouteResult | null> {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${this.baseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      const route = data?.routes?.[0];
      if (!route?.geometry?.coordinates) return null;
      const coordinates: LatLng[] = route.geometry.coordinates.map(
        (c: [number, number]) => ({ lat: c[1], lng: c[0] }),
      );
      return {
        coordinates,
        distanceMeters: route.distance ?? 0,
        durationSeconds: route.duration ?? 0,
      };
    } catch {
      return null;
    }
  }
}

/** Instance de routing utilisée par l'application. */
export const routing: RoutingProvider = new OsrmRoutingProvider();
