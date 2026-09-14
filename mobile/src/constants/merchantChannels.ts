/** Canaux commerçant — stockés sur User.merchantChannels */
export type MerchantChannel = 'antigaspi' | 'marketplace';

export function resolveMerchantChannels(channels?: string[] | null): {
  antigaspi: boolean;
  marketplace: boolean;
} {
  // Legacy : tableau vide → les deux (comptes créés avant le choix)
  const list =
    channels && channels.length > 0 ? channels : (['antigaspi', 'marketplace'] as MerchantChannel[]);
  return {
    antigaspi: list.includes('antigaspi'),
    marketplace: list.includes('marketplace'),
  };
}

export function merchantChannelsLabel(channels?: string[] | null): string {
  const { antigaspi, marketplace } = resolveMerchantChannels(channels);
  if (antigaspi && marketplace) return 'Anti-Gaspi & Marketplace';
  if (antigaspi) return 'Anti-Gaspi';
  if (marketplace) return 'Marketplace';
  return 'Commerçant';
}
