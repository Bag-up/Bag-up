/** Indicatifs supportés (SN par défaut, diaspora / Afrique de l'Ouest). */
export interface PhoneCountry {
  code: string
  name: string
  dial: string
  flag: string
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
]

const KNOWN_DIALS = [
  '971', '245', '229', '228', '226', '225', '224', '223', '222', '221', '220',
  '212', '49', '44', '41', '39', '34', '33', '32', '1',
].sort((a, b) => b.length - a.length)

export function toE164(localOrFull: string, dialCode = '+221'): string {
  let cleaned = localOrFull.replace(/[^\d+]/g, '')
  if (!cleaned) return ''

  if (cleaned.startsWith('+')) return cleaned

  for (const dial of KNOWN_DIALS) {
    if (cleaned.startsWith(dial) && cleaned.length > dial.length + 5) {
      return `+${cleaned}`
    }
  }

  const dialDigits = dialCode.replace(/[^\d]/g, '')
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1)

  return `+${dialDigits}${cleaned}`
}

/** Découpe un E.164 en indicatif connu + numéro local. */
export function splitE164(phone?: string | null): { dial: string; local: string } {
  const cleaned = (phone || '').replace(/[^\d+]/g, '')
  if (!cleaned.startsWith('+')) {
    return { dial: '+221', local: cleaned.replace(/^0/, '') }
  }
  const digits = cleaned.slice(1)
  for (const dial of KNOWN_DIALS) {
    if (digits.startsWith(dial) && digits.length > dial.length + 4) {
      return { dial: `+${dial}`, local: digits.slice(dial.length) }
    }
  }
  return { dial: '+221', local: digits }
}
