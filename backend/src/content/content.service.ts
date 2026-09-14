import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type PromoInput = {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string;
  linkType?: string;
  linkTarget?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
};

type BannerInput = {
  badge?: string | null;
  headline: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string;
  linkType?: string;
  linkTarget?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
};

function parseDate(value?: string | Date | null) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return value instanceof Date ? value : new Date(value);
}

function isCurrentlyActive(item: {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  if (!item.isActive) return false;
  const now = new Date();
  if (item.startsAt && item.startsAt > now) return false;
  if (item.endsAt && item.endsAt < now) return false;
  return true;
}

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicPromos() {
    const items = await this.prisma.marketplacePromo.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return items.filter(isCurrentlyActive);
  }

  async listAdminPromos() {
    return this.prisma.marketplacePromo.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  createPromo(data: PromoInput) {
    return this.prisma.marketplacePromo.create({
      data: {
        title: data.title,
        subtitle: data.subtitle ?? null,
        imageUrl: data.imageUrl ?? null,
        ctaLabel: data.ctaLabel || 'Découvrir',
        linkType: data.linkType || 'market_home',
        linkTarget: data.linkTarget ?? null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        startsAt: parseDate(data.startsAt) ?? null,
        endsAt: parseDate(data.endsAt) ?? null,
      },
    });
  }

  async updatePromo(id: string, data: Partial<PromoInput>) {
    const existing = await this.prisma.marketplacePromo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promo introuvable');
    return this.prisma.marketplacePromo.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.subtitle !== undefined ? { subtitle: data.subtitle } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.ctaLabel !== undefined ? { ctaLabel: data.ctaLabel } : {}),
        ...(data.linkType !== undefined ? { linkType: data.linkType } : {}),
        ...(data.linkTarget !== undefined ? { linkTarget: data.linkTarget } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.startsAt !== undefined ? { startsAt: parseDate(data.startsAt) } : {}),
        ...(data.endsAt !== undefined ? { endsAt: parseDate(data.endsAt) } : {}),
      },
    });
  }

  async removePromo(id: string) {
    const existing = await this.prisma.marketplacePromo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promo introuvable');
    await this.prisma.marketplacePromo.delete({ where: { id } });
    return { ok: true };
  }

  async listPublicBanners() {
    const items = await this.prisma.homeBanner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return items.filter(isCurrentlyActive);
  }

  async listAdminBanners() {
    return this.prisma.homeBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  createBanner(data: BannerInput) {
    return this.prisma.homeBanner.create({
      data: {
        badge: data.badge ?? null,
        headline: data.headline,
        subtitle: data.subtitle ?? null,
        imageUrl: data.imageUrl ?? null,
        ctaLabel: data.ctaLabel || 'Voir',
        linkType: data.linkType || 'antigaspi',
        linkTarget: data.linkTarget ?? null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        startsAt: parseDate(data.startsAt) ?? null,
        endsAt: parseDate(data.endsAt) ?? null,
      },
    });
  }

  async updateBanner(id: string, data: Partial<BannerInput>) {
    const existing = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bannière introuvable');
    return this.prisma.homeBanner.update({
      where: { id },
      data: {
        ...(data.badge !== undefined ? { badge: data.badge } : {}),
        ...(data.headline !== undefined ? { headline: data.headline } : {}),
        ...(data.subtitle !== undefined ? { subtitle: data.subtitle } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.ctaLabel !== undefined ? { ctaLabel: data.ctaLabel } : {}),
        ...(data.linkType !== undefined ? { linkType: data.linkType } : {}),
        ...(data.linkTarget !== undefined ? { linkTarget: data.linkTarget } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.startsAt !== undefined ? { startsAt: parseDate(data.startsAt) } : {}),
        ...(data.endsAt !== undefined ? { endsAt: parseDate(data.endsAt) } : {}),
      },
    });
  }

  async removeBanner(id: string) {
    const existing = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bannière introuvable');
    await this.prisma.homeBanner.delete({ where: { id } });
    return { ok: true };
  }

  async seedDefaults() {
    const [promoCount, bannerCount] = await Promise.all([
      this.prisma.marketplacePromo.count(),
      this.prisma.homeBanner.count(),
    ]);

    if (promoCount === 0) {
      await this.prisma.marketplacePromo.create({
        data: {
          title: 'Top offres du moment',
          subtitle: 'Les promotions marketplace arrivent bientôt',
          ctaLabel: 'Découvrir',
          linkType: 'none',
          sortOrder: 0,
          isActive: true,
        },
      });
    }

    if (bannerCount === 0) {
      await this.prisma.homeBanner.create({
        data: {
          badge: 'Anti-Gaspi',
          headline: 'Luttons ensemble contre le gaspillage',
          subtitle: 'Découvrez les offres près de chez vous',
          ctaLabel: 'Voir les offres',
          linkType: 'antigaspi',
          sortOrder: 0,
          isActive: true,
        },
      });
    }
  }
}
