import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MarketplaceOrderStatus,
  MarketplacePayoutStatus,
  MissionStatus,
  PaymentStatus,
  ProductStatus,
  ServiceType,
  ShopStatus,
  SubscriptionStatus,
  SubscriptionType,
  UserRole,
  UrgencyLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
import { PaymentProviderFactory } from '../payments/providers/payment-provider.factory';
import { InitiateChargeResult } from '../payments/providers/payment-provider.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { ExternalNotificationsService } from '../notifications/external-notifications.service';
import { MissionsService } from '../missions/missions.service';
import {
  CreateMarketplaceOrderDto,
  CreateProductDto,
  CreateShopDto,
  InitiateMarketplacePaymentDto,
  MarketplaceQuoteDto,
  UpdateProductDto,
  UpdateShopDto,
} from '../dto/marketplace.dto';

const LOCAL_DELIVERY_MAX_KM = 80;
/** Forfait livraison locale SN (Livreur Bag’up + Remise à un tiers). */
const FEE_SN_XOF = 2500;
/** Forfait Remise GP diaspora. */
const FEE_GP_XOF = 5000;

type DeliveryMode =
  | 'bagup_courier'
  | 'handoff_tiers'
  | 'handoff_gp'
  /** Legacy — lecture seule */
  | 'pickup_store'
  | 'merchant_courier'
  | 'handoff_sn';

type ActiveDeliveryMode = 'bagup_courier' | 'handoff_tiers' | 'handoff_gp';

function normalizeDeliveryMode(
  raw?: string | null,
  deliverToSelf?: boolean,
): DeliveryMode {
  const m = (raw || '').trim();
  if (m === 'handoff_sn') return 'handoff_tiers'; // compat anciennes commandes
  if (
    m === 'bagup_courier' ||
    m === 'handoff_tiers' ||
    m === 'handoff_gp' ||
    m === 'pickup_store' ||
    m === 'merchant_courier'
  ) {
    return m;
  }
  if (deliverToSelf === false) return 'handoff_tiers';
  return 'bagup_courier';
}

function assertActiveDeliveryMode(mode: DeliveryMode): ActiveDeliveryMode {
  if (mode === 'pickup_store' || mode === 'merchant_courier') {
    throw new BadRequestException(
      'Ce mode de remise n’est plus disponible. Choisissez Livreur Bag’up, Remise à un tiers ou Remise GP diaspora.',
    );
  }
  if (mode === 'handoff_sn') return 'handoff_tiers';
  return mode as ActiveDeliveryMode;
}

function deliveryModeLabel(mode: DeliveryMode): string {
  switch (mode) {
    case 'pickup_store':
      return 'Retrait sur place';
    case 'merchant_courier':
      return 'Livreur du commerçant';
    case 'handoff_sn':
    case 'handoff_tiers':
      return 'Remise à un tiers';
    case 'handoff_gp':
      return 'Remise GP diaspora';
    default:
      return 'Livreur Bag’up';
  }
}

function deliveryFeeForMode(mode: ActiveDeliveryMode): number {
  return mode === 'handoff_gp' ? FEE_GP_XOF : FEE_SN_XOF;
}

const MIN_PHOTOS_TO_PUBLISH = 4;
const COMMISSION_RATE = 5;
const FX_XOF_PER_EUR = Number(process.env.MARKETPLACE_FX_XOF_PER_EUR || 655.957);
/** Marge change en % (ex. 1.5). Bornée 1–2 % métier. */
const FX_MARGIN_PERCENT = Math.min(
  2,
  Math.max(1, Number(process.env.MARKETPLACE_FX_MARGIN_PERCENT || 1.5)),
);
const FX_MARGIN = 1 + FX_MARGIN_PERCENT / 100;
const DAKAR = { lat: 14.7167, lng: -17.4677 };
const PAYOUT_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

/** Fallback GPS livraison si le client n’envoie pas de coords. */
const DELIVERY_FALLBACK: Record<string, { lat: number; lng: number }> = {
  SN: DAKAR,
  FR: { lat: 48.8566, lng: 2.3522 },
  BE: { lat: 50.8503, lng: 4.3517 },
  CH: { lat: 46.2044, lng: 6.1432 },
  CA: { lat: 45.5017, lng: -73.5673 },
};

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly providers: PaymentProviderFactory,
    private readonly notifications: NotificationsService,
    private readonly externalNotifs: ExternalNotificationsService,
    @Inject(forwardRef(() => MissionsService))
    private readonly missions: MissionsService,
  ) {}

  private async assertMerchant(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== UserRole.merchant) {
      throw new ForbiddenException('Réservé aux commerçants');
    }
    if (!user.isVerified) {
      throw new ForbiddenException('Compte commerçant non vérifié');
    }
    return user;
  }

  /** Abo marketplace actif (merchant_monthly success + expiry). */
  async hasActiveMerchantSubscription(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    if (user.subscriptionStatus !== SubscriptionStatus.active) return false;
    if (user.subscriptionExpiry && user.subscriptionExpiry < new Date()) return false;

    const paid = await this.prisma.subscription.findFirst({
      where: {
        userId,
        type: SubscriptionType.merchant_monthly,
        status: PaymentStatus.success,
      },
      orderBy: { createdAt: 'desc' },
    });
    return !!paid;
  }

  private async getOwnedShop(userId: string) {
    const shop = await this.prisma.shop.findFirst({ where: { ownerId: userId } });
    if (!shop) throw new NotFoundException('Aucune boutique. Créez-la d’abord.');
    return shop;
  }

  // ─── Shops ────────────────────────────────────────────────────────────────

  async createShop(dto: CreateShopDto, userId: string) {
    await this.assertMerchant(userId);
    const existing = await this.prisma.shop.findFirst({ where: { ownerId: userId } });
    if (existing) {
      throw new BadRequestException('Une seule boutique par commerçant en V1');
    }

    const hasSub = await this.hasActiveMerchantSubscription(userId);
    return this.prisma.shop.create({
      data: {
        ownerId: userId,
        name: dto.name.trim(),
        logoUrl: dto.logoUrl,
        coverUrl: dto.coverUrl,
        description: dto.description.trim(),
        city: (dto.city || 'Dakar').trim(),
        region: dto.region?.trim(),
        category: dto.category.trim(),
        phone: dto.phone.trim(),
        whatsapp: dto.whatsapp?.trim(),
        instagram: dto.instagram?.trim(),
        facebook: dto.facebook?.trim(),
        tiktok: dto.tiktok?.trim(),
        status: hasSub ? ShopStatus.active : ShopStatus.draft,
      },
    });
  }

  async getMyShop(userId: string) {
    await this.assertMerchant(userId);
    const shop = await this.prisma.shop.findFirst({
      where: { ownerId: userId },
      include: {
        products: { orderBy: { updatedAt: 'desc' } },
        _count: { select: { products: true, orders: true } },
      },
    });
    if (!shop) throw new NotFoundException('Aucune boutique');
    const subscriptionActive = await this.hasActiveMerchantSubscription(userId);
    return { ...shop, subscriptionActive };
  }

  async updateMyShop(dto: UpdateShopDto, userId: string) {
    await this.assertMerchant(userId);
    const shop = await this.getOwnedShop(userId);
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.city !== undefined && { city: dto.city.trim() }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.category !== undefined && { category: dto.category.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp?.trim() || null }),
        ...(dto.instagram !== undefined && { instagram: dto.instagram?.trim() || null }),
        ...(dto.facebook !== undefined && { facebook: dto.facebook?.trim() || null }),
        ...(dto.tiktok !== undefined && { tiktok: dto.tiktok?.trim() || null }),
      },
    });
  }

  async listShops(city?: string) {
    return this.prisma.shop.findMany({
      where: {
        status: ShopStatus.active,
        ...(city ? { city: { equals: city, mode: 'insensitive' } } : { city: { equals: 'Dakar', mode: 'insensitive' } }),
      },
      include: {
        products: {
          where: { status: ProductStatus.available, stock: { gt: 0 } },
          take: 6,
          orderBy: { updatedAt: 'desc' },
        },
        _count: { select: { products: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getShop(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        products: {
          where: { status: ProductStatus.available, stock: { gt: 0 } },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!shop || shop.status !== ShopStatus.active) {
      throw new NotFoundException('Boutique introuvable');
    }
    return shop;
  }

  /** Après paiement abo : passer draft/hidden → active */
  async activateShopForOwner(ownerId: string) {
    const shop = await this.prisma.shop.findFirst({ where: { ownerId } });
    if (!shop) return null;
    if (shop.status === ShopStatus.suspended) return shop;
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: { status: ShopStatus.active },
    });
  }

  async hideShopsForOwner(ownerId: string) {
    await this.prisma.shop.updateMany({
      where: { ownerId, status: ShopStatus.active },
      data: { status: ShopStatus.hidden },
    });
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  async createProduct(dto: CreateProductDto, userId: string) {
    await this.assertMerchant(userId);
    const shop = await this.getOwnedShop(userId);
    const photos = dto.photoUrls ?? [];
    if (photos.length > 6) {
      throw new BadRequestException('Maximum 6 photos par produit');
    }

    return this.prisma.product.create({
      data: {
        shopId: shop.id,
        name: dto.name.trim(),
        priceXof: dto.priceXof,
        description: dto.description.trim(),
        photoUrls: photos,
        weightKg: dto.weightKg,
        lengthCm: dto.lengthCm,
        widthCm: dto.widthCm,
        heightCm: dto.heightCm,
        stock: dto.stock ?? 0,
        status: ProductStatus.draft,
      },
    });
  }

  async listMyProducts(userId: string) {
    await this.assertMerchant(userId);
    const shop = await this.getOwnedShop(userId);
    return this.prisma.product.findMany({
      where: { shopId: shop.id, status: { not: ProductStatus.archived } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { shop: true },
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto, userId: string) {
    await this.assertMerchant(userId);
    const shop = await this.getOwnedShop(userId);
    const product = await this.prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!product) throw new NotFoundException('Produit introuvable');

    if (dto.photoUrls && dto.photoUrls.length > 6) {
      throw new BadRequestException('Maximum 6 photos par produit');
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.priceXof !== undefined && { priceXof: dto.priceXof }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.photoUrls !== undefined && { photoUrls: dto.photoUrls }),
        ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
        ...(dto.lengthCm !== undefined && { lengthCm: dto.lengthCm }),
        ...(dto.widthCm !== undefined && { widthCm: dto.widthCm }),
        ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
      },
    });
  }

  async publishProduct(id: string, userId: string) {
    await this.assertMerchant(userId);
    const shop = await this.getOwnedShop(userId);
    if (!(await this.hasActiveMerchantSubscription(userId))) {
      throw new BadRequestException('Abonnement commerçant (6 500 FCFA/mois) requis');
    }
    if (shop.status !== ShopStatus.active) {
      throw new BadRequestException('Boutique non active. Activez votre abonnement.');
    }

    const product = await this.prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!product) throw new NotFoundException('Produit introuvable');
    if (product.photoUrls.length < MIN_PHOTOS_TO_PUBLISH) {
      throw new BadRequestException(`Au moins ${MIN_PHOTOS_TO_PUBLISH} photos requises pour publier`);
    }
    if (Number(product.priceXof) <= 0) {
      throw new BadRequestException('Prix invalide');
    }
    if (Number(product.weightKg) <= 0) {
      throw new BadRequestException('Poids estimé requis');
    }
    if (product.stock <= 0) {
      throw new BadRequestException('Stock insuffisant');
    }

    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.available },
    });
  }

  async archiveProduct(id: string, userId: string) {
    await this.assertMerchant(userId);
    const shop = await this.getOwnedShop(userId);
    const product = await this.prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!product) throw new NotFoundException('Produit introuvable');
    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.archived },
    });
  }

  // ─── Quote / Orders / Payment ─────────────────────────────────────────────

  private resolveDeliveryCoords(dto: MarketplaceQuoteDto): { lat: number; lng: number } {
    if (dto.deliveryLat != null && dto.deliveryLng != null) {
      return { lat: dto.deliveryLat, lng: dto.deliveryLng };
    }
    const country = (dto.deliveryCountry || 'FR').toUpperCase();
    return DELIVERY_FALLBACK[country] || DELIVERY_FALLBACK.FR;
  }

  private toEur(amountXof: number) {
    const rate = FX_XOF_PER_EUR * FX_MARGIN;
    return Math.round((amountXof / rate) * 100) / 100;
  }

  /** Taux affiché côté app (EUR ↔ XOF). */
  getFxInfo() {
    return {
      baseXofPerEur: FX_XOF_PER_EUR,
      marginPercent: FX_MARGIN_PERCENT,
      effectiveXofPerEur: Math.round(FX_XOF_PER_EUR * FX_MARGIN * 1000) / 1000,
      note: 'Marge change appliquée sur le taux affiché diaspora',
    };
  }

  private async buildQuote(dto: MarketplaceQuoteDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { shop: { include: { owner: true } } },
    });
    if (!product || product.status !== ProductStatus.available) {
      throw new NotFoundException('Produit indisponible');
    }
    if (product.shop.status !== ShopStatus.active) {
      throw new BadRequestException('Boutique non active');
    }
    const qty = dto.quantity ?? 1;
    if (product.stock < qty) throw new BadRequestException('Stock insuffisant');

    const productTotal = Number(product.priceXof) * qty;
    const weight = Number(product.weightKg) * qty;
    const rawMode = normalizeDeliveryMode(dto.deliveryMode, dto.deliverToSelf);
    const mode = assertActiveDeliveryMode(rawMode);

    const pickup = {
      lat: product.shop.owner.businessLat ?? DAKAR.lat,
      lng: product.shop.owner.businessLng ?? DAKAR.lng,
    };
    const pickupAddress =
      product.shop.owner.businessAddress ||
      `${product.shop.name}, ${product.shop.city}`;

    // Livraison / remise : jambe locale SN (jamais Dakar→Paris en haversine)
    const delivery = this.resolveDeliveryCoords({
      ...dto,
      deliveryCountry: 'SN',
    });
    if (dto.deliveryLat == null || dto.deliveryLng == null) {
      throw new BadRequestException(
        'Indiquez une adresse au Sénégal avec une position précise pour la livraison',
      );
    }
    const distanceKm = this.geo.haversineDistance(pickup, delivery);
    if (distanceKm > LOCAL_DELIVERY_MAX_KM) {
      throw new BadRequestException(
        `Hors zone de livraison (${distanceKm.toFixed(0)} km). Maximum ${LOCAL_DELIVERY_MAX_KM} km — choisissez une adresse plus proche.`,
      );
    }

    const deliveryFee = deliveryFeeForMode(mode);
    const total = productTotal + deliveryFee;
    const commissionAmount = Math.round((productTotal * COMMISSION_RATE) / 100);
    const merchantAmount = productTotal - commissionAmount;

    return {
      product,
      quantity: qty,
      productTotalXof: productTotal,
      deliveryFeeXof: deliveryFee,
      totalXof: total,
      commissionAmount,
      merchantAmount,
      distanceKm,
      deliveryMode: mode,
      deliveryModeLabel: deliveryModeLabel(mode),
      pickupAddress,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      deliveryLat: delivery.lat,
      deliveryLng: delivery.lng,
      totalEur: this.toEur(total),
      productEur: this.toEur(productTotal),
      deliveryEur: this.toEur(deliveryFee),
      fxRate: FX_XOF_PER_EUR * FX_MARGIN,
      fxMarginPercent: FX_MARGIN_PERCENT,
      effectiveXofPerEur: Math.round(FX_XOF_PER_EUR * FX_MARGIN * 1000) / 1000,
      weightKg: weight,
    };
  }

  async quote(dto: MarketplaceQuoteDto) {
    const q = await this.buildQuote(dto);
    return {
      productId: q.product.id,
      productName: q.product.name,
      shopId: q.product.shopId,
      shopName: q.product.shop.name,
      quantity: q.quantity,
      productTotalXof: q.productTotalXof,
      deliveryFeeXof: q.deliveryFeeXof,
      totalXof: q.totalXof,
      totalEur: q.totalEur,
      productEur: q.productEur,
      deliveryEur: q.deliveryEur,
      distanceKm: q.distanceKm,
      deliveryMode: q.deliveryMode,
      deliveryModeLabel: q.deliveryModeLabel,
      pickupLat: q.pickupLat,
      pickupLng: q.pickupLng,
      deliveryLat: q.deliveryLat,
      deliveryLng: q.deliveryLng,
      fxRate: q.fxRate,
      fxMarginPercent: q.fxMarginPercent,
      effectiveXofPerEur: q.effectiveXofPerEur,
      currencyDisplayDefault: 'EUR',
      photoUrl: q.product.photoUrls[0] ?? null,
    };
  }

  async createOrder(dto: CreateMarketplaceOrderDto, buyerId: string) {
    const rawMode = normalizeDeliveryMode(dto.deliveryMode, dto.deliverToSelf);
    const mode = assertActiveDeliveryMode(rawMode);
    const q = await this.buildQuote({ ...dto, deliveryMode: mode });
    const orderNumber = `MK-${Date.now().toString(36).toUpperCase()}`;
    const isHandoff = mode === 'handoff_tiers' || mode === 'handoff_gp';
    const deliverToSelf = !isHandoff && dto.deliverToSelf !== false;

    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerId },
      select: { firstName: true, lastName: true, phone: true },
    });
    if (!buyer) throw new NotFoundException('Utilisateur introuvable');

    let recipientName = (dto.recipientName || '').trim();
    let recipientPhone = (dto.recipientPhone || '').trim();
    const recipientRelation = (dto.recipientRelation || '').trim() || null;

    if (isHandoff || !deliverToSelf) {
      if (!recipientName) {
        throw new BadRequestException('Indiquez le nom du destinataire');
      }
      if (!recipientPhone) {
        throw new BadRequestException('Indiquez le téléphone du destinataire');
      }
      if (!dto.deliveryAddress?.trim()) {
        throw new BadRequestException('Indiquez l’adresse de livraison au Sénégal');
      }
      if (!recipientRelation) {
        throw new BadRequestException(
          mode === 'handoff_gp'
            ? 'Précisez le lien / référence GP'
            : 'Précisez votre lien avec le destinataire',
        );
      }
    } else {
      if (!recipientName) {
        recipientName = `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim();
      }
      if (!recipientPhone) {
        recipientPhone = buyer.phone || '';
      }
    }

    if (!recipientName || !recipientPhone) {
      throw new BadRequestException('Nom et téléphone du destinataire requis');
    }

    const deliveryAddress = (dto.deliveryAddress || '').trim() || q.pickupAddress;

    const order = await this.prisma.marketplaceOrder.create({
      data: {
        orderNumber,
        buyerId,
        shopId: q.product.shopId,
        status: MarketplaceOrderStatus.pending_payment,
        productTotalXof: q.productTotalXof,
        deliveryFeeXof: q.deliveryFeeXof,
        totalXof: q.totalXof,
        commissionRate: COMMISSION_RATE,
        commissionAmount: q.commissionAmount,
        merchantAmount: q.merchantAmount,
        currencyDisplay: 'XOF',
        fxRate: q.fxRate,
        fxMarginPercent: q.fxMarginPercent,
        totalDisplay: q.totalXof,
        payoutStatus: MarketplacePayoutStatus.held,
        pickupAddress: q.pickupAddress,
        pickupLat: q.pickupLat,
        pickupLng: q.pickupLng,
        deliveryAddress,
        deliveryLat: q.deliveryLat,
        deliveryLng: q.deliveryLng,
        deliveryCountry: 'SN',
        deliveryMode: mode,
        deliverToSelf: isHandoff ? false : deliverToSelf,
        recipientName,
        recipientPhone,
        recipientRelation: isHandoff || !deliverToSelf ? recipientRelation : null,
        items: {
          create: [
            {
              productId: q.product.id,
              productName: q.product.name,
              unitPriceXof: Number(q.product.priceXof),
              quantity: q.quantity,
              weightKg: Number(q.product.weightKg) * q.quantity,
            },
          ],
        },
      },
      include: { items: true, shop: true },
    });

    return order;
  }

  async initiatePayment(
    orderId: string,
    buyerId: string,
    dto: InitiateMarketplacePaymentDto,
  ): Promise<InitiateChargeResult & { orderId: string; paymentId: string }> {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
      include: { shop: true, items: true, buyer: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.buyerId !== buyerId) throw new ForbiddenException('Accès refusé');
    if (order.status !== MarketplaceOrderStatus.pending_payment) {
      throw new BadRequestException('Cette commande n’est plus en attente de paiement');
    }

    let missionId = order.missionId;
    const orderMode = normalizeDeliveryMode(
      (order as any).deliveryMode,
      order.deliverToSelf,
    );
    const activeMode =
      orderMode === 'pickup_store' || orderMode === 'merchant_courier'
        ? null
        : orderMode === 'handoff_sn'
          ? 'handoff_tiers'
          : (orderMode as ActiveDeliveryMode);
    const needsBagupMission = activeMode != null;

    if (!missionId && needsBagupMission && activeMode) {
      const pickupLat = order.pickupLat != null ? String(order.pickupLat) : String(DAKAR.lat);
      const pickupLng = order.pickupLng != null ? String(order.pickupLng) : String(DAKAR.lng);
      const fallback = DELIVERY_FALLBACK.SN;
      const deliveryLat = order.deliveryLat != null ? String(order.deliveryLat) : String(fallback.lat);
      const deliveryLng = order.deliveryLng != null ? String(order.deliveryLng) : String(fallback.lng);

      const isThirdParty =
        activeMode === 'handoff_tiers' ||
        activeMode === 'handoff_gp' ||
        order.deliverToSelf === false;
      const deliveryCode = isThirdParty
        ? Math.random().toString(36).slice(2, 8).toUpperCase()
        : undefined;

      const mission = await this.prisma.mission.create({
        data: {
          serviceType: ServiceType.collecte_marchandises,
          urgency: UrgencyLevel.standard,
          pickupAddress: order.pickupAddress,
          deliveryAddress: order.deliveryAddress,
          description: `Marketplace ${order.orderNumber} — ${order.shop.name} (${deliveryModeLabel(activeMode)})`,
          price: order.deliveryFeeXof,
          pickupLat,
          pickupLng,
          deliveryLat,
          deliveryLng,
          clientCountry: 'SN',
          clientId: buyerId,
          recipientName: order.recipientName,
          recipientPhone: order.recipientPhone,
          recipientRelation: order.recipientRelation,
          recipientAddress: isThirdParty ? order.deliveryAddress : undefined,
          deliveryCode,
          requiresIdVerification: isThirdParty,
          serviceDetails: {
            marketplaceOrderId: order.id,
            orderNumber: order.orderNumber,
            shopName: order.shop.name,
            products: order.items.map((i) => `${i.quantity}× ${i.productName}`),
            dispatchReady: false,
            deliverToSelf: order.deliverToSelf,
            deliveryMode: activeMode,
            recipientName: order.recipientName,
            recipientPhone: order.recipientPhone,
          },
        },
      });
      missionId = mission.id;
      await this.prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: {
          missionId,
          ...(order.deliveryLat == null && { deliveryLat: Number(deliveryLat), deliveryLng: Number(deliveryLng) }),
          ...(order.pickupLat == null && { pickupLat: Number(pickupLat), pickupLng: Number(pickupLng) }),
        },
      });

      if (deliveryCode && order.buyer?.phone) {
        const codeMsg = `Bag'up - Code de remise ${order.orderNumber}: ${deliveryCode}. Communiquez-le au destinataire.`;
        this.externalNotifs.sendSms(order.buyer.phone, codeMsg).catch((e) => this.logger.error(e));
        this.notifications
          .sendToUser(buyerId, {
            title: 'Code de remise',
            body: `Code ${deliveryCode} pour ${order.recipientName || 'le destinataire'}`,
            data: { orderId: order.id, type: 'marketplace_order', deliveryCode },
          })
          .catch((e) => this.logger.error(e));
      }
    } else if (!missionId && !needsBagupMission) {
      this.logger.log(
        `Marketplace ${order.orderNumber}: pas de mission (${orderMode})`,
      );
    } else if (missionId) {      // Backfill GPS sur missions marketplace déjà créées sans coords
      const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
      if (mission && (!mission.pickupLat || !mission.deliveryLat)) {
        const fallback = DELIVERY_FALLBACK[(order.deliveryCountry || 'FR').toUpperCase()] || DELIVERY_FALLBACK.FR;
        await this.prisma.mission.update({
          where: { id: missionId },
          data: {
            pickupLat: mission.pickupLat || (order.pickupLat != null ? String(order.pickupLat) : String(DAKAR.lat)),
            pickupLng: mission.pickupLng || (order.pickupLng != null ? String(order.pickupLng) : String(DAKAR.lng)),
            deliveryLat: mission.deliveryLat || (order.deliveryLat != null ? String(order.deliveryLat) : String(fallback.lat)),
            deliveryLng: mission.deliveryLng || (order.deliveryLng != null ? String(order.deliveryLng) : String(fallback.lng)),
          },
        });
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        amount: order.totalXof,
        method: dto.method,
        status: PaymentStatus.pending,
        userId: buyerId,
        missionId,
        currency: 'XOF',
      },
    });

    await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: { paymentId: payment.id },
    });

    const country = this.detectCountry(order.buyer?.phone, order.deliveryCountry || order.buyer?.country);
    const provider = this.providers.forCountry(country);
    const result = await provider.initiateCharge({
      paymentId: payment.id,
      amount: Number(order.totalXof),
      currency: 'XOF',
      method: dto.method,
      country,
      customer: {
        name: [order.buyer?.firstName, order.buyer?.lastName].filter(Boolean).join(' ') || undefined,
        phone: order.buyer?.phone,
        email: order.buyer?.email ?? undefined,
        country,
      },
      otp: dto.otp,
      successRedirectUrl: dto.successRedirectUrl,
      errorRedirectUrl: dto.errorRedirectUrl,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider: result.provider,
        providerRef: result.providerRef,
        status:
          result.status === 'success'
            ? PaymentStatus.success
            : result.status === 'failed'
              ? PaymentStatus.failed
              : PaymentStatus.processing,
      },
    });

    if (result.status === 'success') {
      await this.applyPaymentSuccess(payment.id);
    }

    return { ...result, orderId: order.id, paymentId: payment.id };
  }

  /** Appelé après succès paiement (mock immédiat ou webhook via PaymentsService). */
  async applyPaymentSuccess(paymentId: string) {
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { paymentId },
      include: { items: true, shop: true },
    });
    if (!order) return null;
    if (order.status !== MarketplaceOrderStatus.pending_payment) return order;

    const paidAt = new Date();
    const preparationDeadline = new Date(paidAt.getTime() + 48 * 60 * 60 * 1000);

    for (const item of order.items) {
      await this.prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const updated = await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: {
        status: MarketplaceOrderStatus.awaiting_preparation,
        paidAt,
        preparationDeadline,
      },
      include: { shop: true, items: true },
    });

    await this.notifications
      .sendToUser(order.shop.ownerId, {
        title: 'Nouvelle commande marketplace',
        body: `${order.orderNumber} — préparez le colis sous 48 h`,
        data: { orderId: order.id, type: 'marketplace_order' },
      })
      .catch((e) => this.logger.error(e));

    await this.notifications
      .sendToUser(order.buyerId, {
        title: 'Paiement confirmé',
        body: `Commande ${order.orderNumber} — le commerçant prépare votre colis`,
        data: { orderId: order.id, type: 'marketplace_order' },
      })
      .catch((e) => this.logger.error(e));

    // Suivi admin : pas d’assignation manuelle obligatoire — filet de sécurité
    await this.notifications
      .sendToAdmins({
        title: 'Nouvelle commande marketplace',
        body: `${order.orderNumber} · ${order.shop.name} — en préparation`,
        data: { orderId: order.id, type: 'marketplace_order' },
      })
      .catch((e) => this.logger.error(e));

    return updated;
  }

  async applyPaymentSuccessByMission(missionId: string) {
    const order = await this.prisma.marketplaceOrder.findFirst({ where: { missionId } });
    if (!order?.paymentId) return null;
    return this.applyPaymentSuccess(order.paymentId);
  }

  async myOrders(buyerId: string) {
    return this.prisma.marketplaceOrder.findMany({
      where: { buyerId },
      include: { shop: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async shopOrders(ownerId: string) {
    const shop = await this.getOwnedShop(ownerId);
    return this.prisma.marketplaceOrder.findMany({
      where: { shopId: shop.id },
      include: { items: true, buyer: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrder(id: string, userId: string) {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id },
      include: {
        shop: true,
        items: true,
        mission: true,
        buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.buyerId !== userId && order.shop.ownerId !== userId) {
      throw new ForbiddenException('Accès refusé');
    }
    return order;
  }

  /** Commerçant : colis prêt → mission visible pour les livreurs. */
  async markPrepared(orderId: string, ownerId: string) {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
      include: { shop: true, mission: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.shop.ownerId !== ownerId) throw new ForbiddenException('Accès refusé');
    if (order.status !== MarketplaceOrderStatus.awaiting_preparation) {
      throw new BadRequestException('Cette commande n’attend plus de préparation');
    }
    if (!order.missionId) {
      throw new BadRequestException('Mission logistique manquante');
    }

    const mission = order.mission;
    const details = {
      ...((mission?.serviceDetails as Record<string, unknown>) || {}),
      dispatchReady: true,
    };

    await this.prisma.mission.update({
      where: { id: order.missionId },
      data: { serviceDetails: details },
    });

    const updated = await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: { status: MarketplaceOrderStatus.collection_scheduled },
      include: { shop: true, items: true, mission: true },
    });

    await this.missions.dispatchToProviders(order.missionId).catch((e) => this.logger.error(e));

    await this.notifications
      .sendToUser(order.buyerId, {
        title: 'Colis prêt',
        body: `${order.orderNumber} — un livreur Bag'up va le collecter`,
        data: { orderId: order.id, type: 'marketplace_order' },
      })
      .catch((e) => this.logger.error(e));

    await this.notifications
      .sendToAdmins({
        title: 'Colis marketplace prêt',
        body: `${order.orderNumber} — dispatch livreurs en cours`,
        data: { orderId: order.id, missionId: order.missionId, type: 'marketplace_order' },
      })
      .catch((e) => this.logger.error(e));

    return updated;
  }

  async adminListOrders(status?: string) {
    const where =
      status && Object.values(MarketplaceOrderStatus).includes(status as MarketplaceOrderStatus)
        ? { status: status as MarketplaceOrderStatus }
        : {};
    return this.prisma.marketplaceOrder.findMany({
      where,
      include: {
        shop: {
          include: {
            owner: { select: { id: true, phone: true, firstName: true, lastName: true } },
          },
        },
        items: true,
        buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        mission: {
          include: {
            provider: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Filet de sécurité : l’admin force l’assignation d’un livreur
   * si personne n’a accepté la mission après le dispatch auto.
   */
  async adminAssignProvider(orderId: string, providerId: string) {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
      include: { shop: true, mission: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (!order.missionId || !order.mission) {
      throw new BadRequestException('Mission logistique manquante');
    }
    if (
      order.status === MarketplaceOrderStatus.cancelled ||
      order.status === MarketplaceOrderStatus.delivered ||
      order.status === MarketplaceOrderStatus.pending_payment
    ) {
      throw new BadRequestException('Commande non éligible à l’assignation');
    }

    const mission = order.mission;
    if (mission.providerId && mission.status !== MissionStatus.pending) {
      throw new BadRequestException('Un livreur est déjà assigné à cette mission');
    }

    // Débloquer le dispatch si le commerçant n’a pas encore marqué « prêt »
    const details = {
      ...((mission.serviceDetails as Record<string, unknown>) || {}),
      dispatchReady: true,
    };
    await this.prisma.mission.update({
      where: { id: mission.id },
      data: { serviceDetails: details },
    });

    if (order.status === MarketplaceOrderStatus.awaiting_preparation) {
      await this.prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: { status: MarketplaceOrderStatus.collection_scheduled },
      });
    }

    await this.missions.adminAssign(mission.id, providerId);

    return this.prisma.marketplaceOrder.findUnique({
      where: { id: order.id },
      include: {
        shop: true,
        items: true,
        buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        mission: {
          include: {
            provider: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });
  }

  /** Mapping mission → statut commande + escrow J+2 à la livraison. */
  async syncFromMission(missionId: string, missionStatus: MissionStatus | string) {
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { missionId },
      include: { shop: true },
    });
    if (!order) return null;
    if (
      order.status === MarketplaceOrderStatus.cancelled ||
      order.status === MarketplaceOrderStatus.delivered
    ) {
      return order;
    }

    const map: Partial<Record<string, MarketplaceOrderStatus>> = {
      [MissionStatus.accepted]: MarketplaceOrderStatus.collection_scheduled,
      [MissionStatus.en_route]: MarketplaceOrderStatus.collection_scheduled,
      [MissionStatus.picked_up]: MarketplaceOrderStatus.collected,
      [MissionStatus.in_progress]: MarketplaceOrderStatus.in_transit,
      [MissionStatus.delivered]: MarketplaceOrderStatus.delivered,
      [MissionStatus.cancelled]: MarketplaceOrderStatus.cancelled,
    };

    const next = map[missionStatus];
    if (!next) return order;

    const data: Record<string, unknown> = { status: next };
    if (next === MarketplaceOrderStatus.delivered) {
      const deliveredAt = new Date();
      data.deliveredAt = deliveredAt;
      data.payoutEligibleAt = new Date(deliveredAt.getTime() + PAYOUT_DELAY_MS);
      // reste held jusqu’au cron J+2 → eligible
    }
    if (next === MarketplaceOrderStatus.cancelled) {
      data.cancelledAt = new Date();
      data.cancelReason = 'Mission annulée';
      data.payoutStatus = MarketplacePayoutStatus.cancelled;
    }

    const updated = await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data,
    });

    if (next === MarketplaceOrderStatus.delivered) {
      await this.notifications
        .sendToUser(order.shop.ownerId, {
          title: 'Commande livrée',
          body: `${order.orderNumber} — reversement éligible dans 2 jours`,
          data: { orderId: order.id, type: 'marketplace_payout' },
        })
        .catch((e) => this.logger.error(e));
    } else if (next === MarketplaceOrderStatus.collected) {
      await this.notifications
        .sendToUser(order.buyerId, {
          title: 'Colis récupéré',
          body: `${order.orderNumber} — en route vers vous`,
          data: {
            orderId: order.id,
            missionId: missionId,
            type: 'marketplace_order',
          },
        })
        .catch((e) => this.logger.error(e));
    } else if (next === MarketplaceOrderStatus.in_transit) {
      await this.notifications
        .sendToUser(order.buyerId, {
          title: 'Livraison en cours',
          body: `${order.orderNumber} — le livreur arrive bientôt`,
          data: {
            orderId: order.id,
            missionId: missionId,
            type: 'marketplace_order',
          },
        })
        .catch((e) => this.logger.error(e));
    } else if (next === MarketplaceOrderStatus.cancelled) {
      await this.notifications
        .sendToUser(order.buyerId, {
          title: 'Commande annulée',
          body: `${order.orderNumber} — la livraison a été annulée`,
          data: { orderId: order.id, type: 'marketplace_order' },
        })
        .catch((e) => this.logger.error(e));
    }

    return updated;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cancelUnpreparedOrdersCron() {
    const now = new Date();
    const overdue = await this.prisma.marketplaceOrder.findMany({
      where: {
        status: MarketplaceOrderStatus.awaiting_preparation,
        preparationDeadline: { lt: now },
      },
      include: { items: true, shop: true },
    });

    for (const order of overdue) {
      try {
        await this.cancelOrderInternal(order.id, 'Non préparé sous 48 h — remboursement client');
        this.logger.log(`Marketplace order ${order.orderNumber} cancelled (48h)`);
      } catch (e) {
        this.logger.error(`Failed cancel ${order.id}`, e as Error);
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markPayoutsEligibleCron() {
    const now = new Date();
    const result = await this.prisma.marketplaceOrder.updateMany({
      where: {
        status: MarketplaceOrderStatus.delivered,
        payoutStatus: MarketplacePayoutStatus.held,
        payoutEligibleAt: { lte: now },
      },
      data: { payoutStatus: MarketplacePayoutStatus.eligible },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} payout(s) marketplace éligible(s) J+2`);
    }
  }

  private async cancelOrderInternal(orderId: string, reason: string) {
    const order = await this.prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
      include: { items: true, shop: true },
    });
    if (!order) return;
    if (order.status === MarketplaceOrderStatus.cancelled) return;

    for (const item of order.items) {
      await this.prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    if (order.paymentId) {
      await this.prisma.payment.update({
        where: { id: order.paymentId },
        data: { status: PaymentStatus.refunded },
      });
    }

    if (order.missionId) {
      await this.prisma.mission.update({
        where: { id: order.missionId },
        data: { status: MissionStatus.cancelled },
      });
    }

    await this.prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: {
        status: MarketplaceOrderStatus.cancelled,
        cancelledAt: new Date(),
        cancelReason: reason,
        payoutStatus: MarketplacePayoutStatus.cancelled,
      },
    });

    await this.notifications
      .sendToUser(order.buyerId, {
        title: 'Commande annulée',
        body: `${order.orderNumber} — ${reason}`,
        data: { orderId: order.id, type: 'marketplace_order' },
      })
      .catch((e) => this.logger.error(e));

    await this.notifications
      .sendToUser(order.shop.ownerId, {
        title: 'Commande annulée',
        body: `${order.orderNumber} — ${reason}`,
        data: { orderId: order.id, type: 'marketplace_order' },
      })
      .catch((e) => this.logger.error(e));
  }

  async adminListPayouts() {
    return this.prisma.marketplaceOrder.findMany({
      where: {
        payoutStatus: { in: [MarketplacePayoutStatus.eligible, MarketplacePayoutStatus.paid_out] },
      },
      include: {
        shop: { include: { owner: { select: { id: true, phone: true, firstName: true, lastName: true } } } },
        items: true,
      },
      orderBy: { payoutEligibleAt: 'asc' },
    });
  }

  async adminMarkPaidOut(orderId: string) {
    const order = await this.prisma.marketplaceOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.payoutStatus !== MarketplacePayoutStatus.eligible) {
      throw new BadRequestException('Payout non éligible');
    }
    return this.prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: {
        payoutStatus: MarketplacePayoutStatus.paid_out,
        paidOutAt: new Date(),
      },
    });
  }

  private detectCountry(phone?: string | null, country?: string | null): string {
    if (country && country.length === 2) return country.toUpperCase();
    if (phone?.startsWith('+221') || phone?.startsWith('221')) return 'SN';
    if (phone?.startsWith('+33') || phone?.startsWith('33')) return 'FR';
    return 'SN';
  }
}
