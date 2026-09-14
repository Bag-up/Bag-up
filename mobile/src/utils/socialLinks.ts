/** Normalize @handle or URL for shop social fields. */

export function normalizeSocialInput(raw?: string | null): string | undefined {
  const v = (raw || '').trim();
  return v || undefined;
}

export function socialProfileUrl(
  network: 'instagram' | 'facebook' | 'tiktok' | 'whatsapp',
  value?: string | null,
): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;

  const handle = v.replace(/^@/, '').replace(/^\//, '');

  switch (network) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle.replace(/^@/, '')}`;
    case 'whatsapp': {
      const digits = v.replace(/[^\d+]/g, '').replace(/^\+/, '');
      if (!digits) return null;
      return `https://wa.me/${digits}`;
    }
    default:
      return null;
  }
}
