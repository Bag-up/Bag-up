import * as Location from 'expo-location';

export interface GeoAddress {
  label: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

/** Détecte lat/lng collés (Yango, Google Maps, plain texte). */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const raw = text.trim();
  if (!raw) return null;

  const candidates: Array<[string, string]> = [];
  const push = (a?: string, b?: string) => {
    if (a && b) candidates.push([a, b]);
  };

  // URLs Google / Apple / geo:
  let m =
    raw.match(/[?&](?:q|ll|query)=(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i) ||
    raw.match(/@(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/) ||
    raw.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/) ||
    raw.match(/^geo:(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
  if (m) push(m[1], m[2]);

  // "14.7167, -17.4677" ou "14.7167 -17.4677"
  m = raw.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (m) push(m[1], m[2]);

  // Parfois "lat: 14.7 lng: -17.4"
  m = raw.match(/lat(?:itude)?\s*[:=]?\s*(-?\d+\.?\d*).{0,24}?(?:lng|lon|long(?:itude)?)\s*[:=]?\s*(-?\d+\.?\d*)/i);
  if (m) push(m[1], m[2]);

  for (const [a, b] of candidates) {
    const lat = parseFloat(a);
    const lng = parseFloat(b);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    // Évite les faux positifs genre "12, 34" sans décimales utiles
    if (!a.includes('.') && !b.includes('.') && Math.abs(lat) < 2 && Math.abs(lng) < 2) continue;
    return { lat, lng };
  }
  return null;
}

export async function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission de localisation refusée');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoAddress | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results.length === 0) return null;
    const r = results[0];
    const parts: string[] = [];
    if (r.name) parts.push(r.name);
    if (r.street) parts.push(r.street);
    if (r.district) parts.push(r.district);
    if (r.city) parts.push(r.city);
    const label = parts.filter(Boolean).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    return {
      label,
      city: r.city || r.region || '',
      country: r.country || 'Sénégal',
      lat,
      lng,
    };
  } catch {
    return null;
  }
}

export async function getCurrentAddress(): Promise<GeoAddress | null> {
  const { lat, lng } = await getCurrentPosition();
  return await reverseGeocode(lat, lng);
}

export async function geocodeAddress(query: string): Promise<GeoAddress[]> {
  try {
    const results = await Location.geocodeAsync(query);
    return results.map(r => ({
      label: query,
      city: '',
      country: 'Sénégal',
      lat: r.latitude,
      lng: r.longitude,
    }));
  } catch {
    return [];
  }
}
