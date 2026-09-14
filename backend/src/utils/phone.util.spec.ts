import { isSenegalPhone, normalizePhoneE164, requiresPhoneVerification } from './phone.util';

describe('phone.util', () => {
  it('normalise un numéro sénégalais local', () => {
    expect(normalizePhoneE164('77 123 45 67')).toBe('+221771234567');
    expect(normalizePhoneE164('0771234567')).toBe('+221771234567');
  });

  it('normalise un numéro français', () => {
    expect(normalizePhoneE164('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhoneE164('33612345678')).toBe('+33612345678');
    expect(normalizePhoneE164('0612345678', '+33')).toBe('+33612345678');
  });

  it('détecte le Sénégal', () => {
    expect(isSenegalPhone('+221771234567')).toBe(true);
    expect(isSenegalPhone('+33612345678')).toBe(false);
  });

  it('accepte la vérification pour SN et FR', () => {
    expect(requiresPhoneVerification('+221771234567')).toBe(true);
    expect(requiresPhoneVerification('+33612345678')).toBe(true);
    expect(requiresPhoneVerification('123')).toBe(false);
  });
});
