/** Feature flag — builds production sans EXPO_PUBLIC_MARKETPLACE_ENABLED=true : marketplace masqué. */
export const MARKETPLACE_ENABLED =
  process.env.EXPO_PUBLIC_MARKETPLACE_ENABLED === 'true' ||
  (typeof __DEV__ !== 'undefined' && __DEV__);

export const SHOP_CATEGORIES = [
  { id: 'artisanat', label: 'Artisanat' },
  { id: 'mode', label: 'Mode' },
  { id: 'alimentaire', label: 'Alimentaire' },
  { id: 'cosmetique', label: 'Cosmétique' },
  { id: 'autre', label: 'Autre' },
] as const;

export const MERCHANT_SUBSCRIPTION_AMOUNT = 6500;
export const MIN_PRODUCT_PHOTOS = 4;
export const MAX_PRODUCT_PHOTOS = 6;
