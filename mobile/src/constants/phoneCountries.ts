/** Indicatifs supportés (SN par défaut, diaspora / Afrique de l'Ouest). */
export interface PhoneCountry {
  code: string; // ISO lite
  name: string;
  dial: string; // ex: +221
  flag: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'SN', name: 'Sénégal', dial: '+221', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', flag: '🇨🇮' },
  { code: 'ML', name: 'Mali', dial: '+223', flag: '🇲🇱' },
  { code: 'GN', name: 'Guinée', dial: '+224', flag: '🇬🇳' },
  { code: 'MR', name: 'Mauritanie', dial: '+222', flag: '🇲🇷' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226', flag: '🇧🇫' },
  { code: 'TG', name: 'Togo', dial: '+228', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin', dial: '+229', flag: '🇧🇯' },
  { code: 'GM', name: 'Gambie', dial: '+220', flag: '🇬🇲' },
  { code: 'GW', name: 'Guinée-Bissau', dial: '+245', flag: '🇬🇼' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', dial: '+32', flag: '🇧🇪' },
  { code: 'CH', name: 'Suisse', dial: '+41', flag: '🇨🇭' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'US', name: 'États-Unis', dial: '+1', flag: '🇺🇸' },
  { code: 'IT', name: 'Italie', dial: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Espagne', dial: '+34', flag: '🇪🇸' },
  { code: 'GB', name: 'Royaume-Uni', dial: '+44', flag: '🇬🇧' },
  { code: 'DE', name: 'Allemagne', dial: '+49', flag: '🇩🇪' },
  { code: 'AE', name: 'Émirats Arabes Unis', dial: '+971', flag: '🇦🇪' },
  { code: 'MA', name: 'Maroc', dial: '+212', flag: '🇲🇦' },
];

/** Indicatifs internationaux connus (du plus long au plus court pour détecter sans +). */
const KNOWN_DIALS = [
  '971', '245', '229', '228', '226', '225', '224', '223', '222', '221', '220',
  '212', '49', '44', '41', '39', '34', '33', '32', '1',
].sort((a, b) => b.length - a.length);

/**
 * Construit un numéro E.164.
 * - Si l'utilisateur tape déjà +33... / +221... → on respecte
 * - Si format international 00… → converti en +
 * - Sinon on combine l'indicatif choisi + le numéro local
 * - Évite le double indicatif (+221221…) et le 0 local résiduel (+22107…)
 */
export function toE164(localOrFull: string, dialCode = '+221'): string {
  let cleaned = localOrFull.replace(/[^\d+]/g, '').trim();
  if (!cleaned) return '';

  // 0022177… → +22177…
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    for (const dial of KNOWN_DIALS) {
      const doubled = dial + dial;
      if (digits.startsWith(doubled) && digits.length > dial.length * 2 + 5) {
        return `+${dial}${digits.slice(dial.length * 2)}`;
      }
    }
    return cleaned;
  }

  for (const dial of KNOWN_DIALS) {
    if (cleaned.startsWith(dial) && cleaned.length > dial.length + 5) {
      return `+${cleaned}`;
    }
  }

  const dialDigits = dialCode.replace(/[^\d]/g, '');
  // Zéros locaux (07… / 077…)
  while (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  // Si le local recommence déjà par l'indicatif choisi
  if (cleaned.startsWith(dialDigits) && cleaned.length > dialDigits.length + 5) {
    return `+${cleaned}`;
  }

  return `+${dialDigits}${cleaned}`;
}

export function findPhoneCountry(dialOrName: string): PhoneCountry | undefined {
  const q = dialOrName.trim().toLowerCase();
  return PHONE_COUNTRIES.find(
    (c) =>
      c.dial === dialOrName ||
      c.code.toLowerCase() === q ||
      c.name.toLowerCase() === q ||
      c.dial.replace('+', '') === q.replace('+', ''),
  );
}

/** Affichage lisible d'un numéro E.164 (+221…, +33…). */
export function formatPhoneDisplay(e164: string): string {
  const normalized = toE164(e164);
  if (!normalized) return '…';

  const byDial = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of byDial) {
    if (normalized.startsWith(country.dial)) {
      const local = normalized.slice(country.dial.length);
      const grouped = local.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
      return `${country.dial} ${grouped}`;
    }
  }
  return normalized;
}

export function phoneCountryForE164(e164: string): PhoneCountry | undefined {
  const normalized = toE164(e164);
  if (!normalized) return undefined;
  const byDial = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  return byDial.find((c) => normalized.startsWith(c.dial));
}

/** Sénégal = SMS OTP ; hors SN = email. */
export function isSenegalPhone(e164: string): boolean {
  return toE164(e164).startsWith('+221');
}
