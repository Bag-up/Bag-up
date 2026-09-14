/** Indicatifs internationaux connus (du plus long au plus court). */
export const KNOWN_PHONE_DIALS = [
  '971', '245', '229', '228', '226', '225', '224', '223', '222', '221', '220',
  '212', '49', '44', '41', '39', '34', '33', '32', '1',
].sort((a, b) => b.length - a.length);

/**
 * Normalise un numéro au format E.164 (+221…, +33…, etc.).
 * Compatible Sénégal (local 77… / 07…) et indicatifs internationaux.
 */
export function normalizePhoneE164(phone: string, defaultDial = '+221'): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return cleaned;

  if (cleaned.startsWith('00') && cleaned.length >= 10) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith('+')) return cleaned;

  for (const dial of KNOWN_PHONE_DIALS) {
    if (cleaned.startsWith(dial) && cleaned.length > dial.length + 5) {
      return `+${cleaned}`;
    }
  }

  let local = cleaned;
  while (local.startsWith('0')) local = local.slice(1);

  // Numéro local sénégalais : 77… / 33… (9 chiffres)
  if (/^7\d{8}$/.test(local) || /^3\d{8}$/.test(local)) {
    return `+221${local}`;
  }

  for (const dial of KNOWN_PHONE_DIALS) {
    if (local.startsWith(dial) && local.length > dial.length + 5) {
      return `+${local}`;
    }
  }

  const dialDigits = defaultDial.replace(/[^\d]/g, '');
  if (dialDigits && local.length >= 6) {
    if (local.startsWith(dialDigits) && local.length > dialDigits.length + 5) {
      return `+${local}`;
    }
    return `+${dialDigits}${local}`;
  }

  if (local.length >= 10) return `+${local}`;

  return `+221${local}`;
}

export function isSenegalPhone(phone: string): boolean {
  return normalizePhoneE164(phone).startsWith('+221');
}

/** Numéros éligibles à la vérification SMS (SN + diaspora / international). */
export function requiresPhoneVerification(phone: string): boolean {
  const e164 = normalizePhoneE164(phone);
  if (!/^\+\d{8,15}$/.test(e164)) return false;
  const digits = e164.slice(1);
  return KNOWN_PHONE_DIALS.some(
    (dial) => digits.startsWith(dial) && digits.length > dial.length + 5,
  );
}
