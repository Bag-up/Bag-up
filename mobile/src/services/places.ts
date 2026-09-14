/**
 * Google Places Autocomplete (classic) — restreint au Sénégal.
 * Utilise EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY (requêtes HTTP côté app).
 */

export type PlacePrediction = {
  placeId: string;
  label: string;
  subtitle: string;
};

export type PlaceDetails = {
  label: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
};

let placesApiBlocked = false;

function getWebKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ||
    ''
  ).trim();
}

export function isPlacesConfigured(): boolean {
  return !placesApiBlocked && getWebKey().length > 0;
}

export function createPlacesSessionToken(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function autocompletePlaces(
  input: string,
  sessionToken: string,
  options?: { country?: string | null; language?: string },
): Promise<PlacePrediction[]> {
  const key = getWebKey();
  if (!key || input.trim().length < 2) return [];

  // null = pas de filtre pays ; undefined = défaut Sénégal
  const country =
    options?.country === null ? null : (options?.country ?? 'sn');
  const language = options?.language || 'fr';
  const params = new URLSearchParams({
    input: input.trim(),
    key,
    language,
    sessiontoken: sessionToken,
  });
  if (country) params.set('components', `country:${country}`);

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
    );
    const data = await res.json();
    if (data.status === 'REQUEST_DENIED') {
      placesApiBlocked = true;
      console.warn(
        'Places autocomplete disabled: this key likely has referer restrictions. Falling back to local addresses only.',
      );
      return [];
    }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Places autocomplete:', data.status, data.error_message);
      return [];
    }
    return (data.predictions || []).map((p: any) => ({
      placeId: p.place_id as string,
      label: (p.structured_formatting?.main_text || p.description || '') as string,
      subtitle: (p.structured_formatting?.secondary_text || p.description || '') as string,
    }));
  } catch (e) {
    console.warn('Places autocomplete network error', e);
    return [];
  }
}

export async function getPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails | null> {
  const key = getWebKey();
  if (!key || !placeId) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    key,
    language: 'fr',
    fields: 'geometry,formatted_address,name,address_component',
    sessiontoken: sessionToken,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
    );
    const data = await res.json();
    if (data.status === 'REQUEST_DENIED') {
      placesApiBlocked = true;
      console.warn(
        'Places details disabled: this key likely has referer restrictions. Falling back to local addresses only.',
      );
      return null;
    }
    if (data.status !== 'OK' || !data.result?.geometry?.location) {
      console.warn('Places details:', data.status, data.error_message);
      return null;
    }

    const result = data.result;
    const components: Array<{ long_name: string; types: string[] }> =
      result.address_components || [];
    const find = (type: string) =>
      components.find((c) => c.types.includes(type))?.long_name || '';

    const city =
      find('locality') ||
      find('administrative_area_level_2') ||
      find('administrative_area_level_1') ||
      '';
    const country = find('country') || 'Sénégal';

    return {
      label: result.formatted_address || result.name || '',
      city,
      country,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };
  } catch (e) {
    console.warn('Places details network error', e);
    return null;
  }
}
