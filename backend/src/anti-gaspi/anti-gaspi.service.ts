import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  AntiGaspiBasketStatus,
  AntiGaspiPayoutStatus,
  AntiGaspiReservationStatus,
  AntiGaspiTxStatus,
  AntiGaspiTxType,
  UserRole,
} from '@prisma/client';
import {
  CreateAntiGaspiBasketDto,
  InitiateAntiGaspiPaymentDto,
  UpdateAntiGaspiBasketDto,
  UpdateAntiGaspiSettingsDto,
} from '../dto/anti-gaspi.dto';
import { PaymentProviderFactory } from '../payments/providers/payment-provider.factory';
import { InitiateChargeResult, ProviderChargeStatus } from '../payments/providers/payment-provider.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class AntiGaspiService {
  private readonly logger = new Logger(AntiGaspiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderFactory,
    private readonly notifications: NotificationsService,
    private readonly loyalty: LoyaltyService,
  ) {}

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  async getSettings() {
    const existing = await this.prisma.antiGaspiSettings.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      // Anciens défauts 60 / 120 min → alignement produit confirmé : 48 h
      if (existing.basketExpiryMinutes === 60 || existing.basketExpiryMinutes === 120) {
        return this.prisma.antiGaspiSettings.update({
          where: { id: existing.id },
          data: { basketExpiryMinutes: 2880 },
        });
      }
      return existing;
    }
    return this.prisma.antiGaspiSettings.create({
      data: { basketExpiryMinutes: 2880 },
    });
  }

  async updateSettings(dto: UpdateAntiGaspiSettingsDto) {
    const current = await this.getSettings();
    return this.prisma.antiGaspiSettings.update({
      where: { id: current.id },
      data: {
        commissionRate: dto.commissionRate ?? current.commissionRate,
        basketExpiryMinutes: dto.basketExpiryMinutes ?? current.basketExpiryMinutes,
        paymentTimeoutMinutes: dto.paymentTimeoutMinutes ?? current.paymentTimeoutMinutes,
        maxActiveBaskets: dto.maxActiveBaskets ?? current.maxActiveBaskets,
        refundPolicy: dto.refundPolicy ?? current.refundPolicy,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Baskets (merchant)
  // ---------------------------------------------------------------------------

  private async assertMerchant(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== UserRole.merchant) {
      throw new ForbiddenException('Réservé aux commerçants Anti-Gaspi');
    }
    if (!user.isVerified) {
      throw new ForbiddenException('Compte commerçant non vérifié');
    }
    return user;
  }

  async createBasket(dto: CreateAntiGaspiBasketDto, merchantId: string) {
    await this.assertMerchant(merchantId);
    const settings = await this.getSettings();

    // Règle métier El Hadji : max N articles actifs (dispo + réservés) ; enlever pour en republier
    const activeCount = await this.prisma.antiGaspiBasket.count({
      where: {
        merchantId,
        status: {
          in: [AntiGaspiBasketStatus.available, AntiGaspiBasketStatus.reserved],
        },
      },
    });
    const maxActive = settings.maxActiveBaskets ?? 3;
    if (activeCount >= maxActive) {
      throw new BadRequestException(
        `Limite atteinte : maximum ${maxActive} articles actifs. Retirez-en un pour en publier un autre.`,
      );
    }

    const price = Number(dto.price);
    const commissionRate = settings.commissionRate;
    const commissionAmount = Math.round(price * commissionRate);
    const merchantAmount = price - commissionAmount;

    const pickupStart = new Date(dto.pickupStartAt);
    const pickupEnd = new Date(dto.pickupEndAt);
    if (pickupEnd <= pickupStart) {
      throw new BadRequestException('Le créneau de retrait est invalide');
    }
    if (pickupEnd <= new Date()) {
      throw new BadRequestException('Le créneau de retrait est déjà passé');
    }

    const expiresAt = new Date(
      Math.min(
        pickupEnd.getTime(),
        Date.now() + settings.basketExpiryMinutes * 60 * 1000,
      ),
    );

    const basket = await this.prisma.antiGaspiBasket.create({
      data: {
        merchantId,
        title: dto.title,
        description: dto.description,
        photoUrl: dto.photoUrl,
        price,
        commissionAmount,
        merchantAmount,
        commissionRateUsed: commissionRate,
        pickupAddress: dto.pickupAddress,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        pickupStartAt: pickupStart,
        pickupEndAt: pickupEnd,
        deliveryRequested: dto.deliveryRequested ?? false,
        expiresAt,
        status: AntiGaspiBasketStatus.available,
      },
    });

    // Notifier les clients ayant déjà commandé chez ce commerçant
    const pastClients = await this.prisma.antiGaspiReservation.findMany({
      where: {
        basket: { merchantId },
        status: { in: ['completed', 'paid', 'merchant_confirmed', 'client_confirmed'] },
        clientId: { not: merchantId },
      },
      select: { clientId: true },
      distinct: ['clientId'],
      take: 80,
    });
    const merchant = await this.prisma.user.findUnique({
      where: { id: merchantId },
      select: { businessName: true, firstName: true },
    });
    const shopLabel = merchant?.businessName || merchant?.firstName || 'Un commerçant';
    for (const c of pastClients) {
      this.notifications
        .sendToUser(c.clientId, {
          title: 'Nouveau panier Anti-Gaspi',
          body: `${shopLabel} : ${dto.title} · ${price.toLocaleString('fr-FR')} F`,
          data: { type: 'antigaspi', basketId: basket.id },
        })
        .catch((e) => this.logger.error(e));
    }

    return basket;
  }

  async updateBasket(id: string, dto: UpdateAntiGaspiBasketDto, merchantId: string) {
    const basket = await this.prisma.antiGaspiBasket.findUnique({ where: { id } });
    if (!basket) throw new NotFoundException('Panier introuvable');
    if (basket.merchantId !== merchantId) throw new ForbiddenException('Ce panier ne vous appartient pas');
    if (basket.status !== AntiGaspiBasketStatus.available) {
      throw new BadRequestException('Seuls les paniers disponibles peuvent être modifiés');
    }

    return this.prisma.antiGaspiBasket.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        photoUrl: dto.photoUrl,
        pickupAddress: dto.pickupAddress,
        pickupStartAt: dto.pickupStartAt ? new Date(dto.pickupStartAt) : undefined,
        pickupEndAt: dto.pickupEndAt ? new Date(dto.pickupEndAt) : undefined,
      },
    });
  }

  async cancelBasket(id: string, merchantId: string) {
    const basket = await this.prisma.antiGaspiBasket.findUnique({ where: { id } });
    if (!basket) throw new NotFoundException('Panier introuvable');
    if (basket.merchantId !== merchantId) throw new ForbiddenException('Ce panier ne vous appartient pas');
    if (basket.status !== AntiGaspiBasketStatus.available) {
      throw new BadRequestException('Ce panier ne peut plus être annulé');
    }
    return this.prisma.antiGaspiBasket.update({
      where: { id },
      data: { status: AntiGaspiBasketStatus.cancelled },
    });
  }

  async myBaskets(merchantId: string) {
    await this.assertMerchant(merchantId);
    return this.prisma.antiGaspiBasket.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      include: {
        reservations: {
          select: { id: true, status: true, clientId: true, createdAt: true },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Baskets (client browse)
  // ---------------------------------------------------------------------------

  async listAvailable(lat?: number, lng?: number, radiusKm = 15) {
    const now = new Date();
    const baskets = await this.prisma.antiGaspiBasket.findMany({
      where: {
        status: AntiGaspiBasketStatus.available,
        expiresAt: { gt: now },
        pickupEndAt: { gt: now },
      },
      include: {
        merchant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            businessName: true,
            businessAddress: true,
            avatarUrl: true,
            rating: true,
          },
        },
      },
      orderBy: { pickupStartAt: 'asc' },
    });

    if (lat == null || lng == null) return baskets;

    return baskets
      .map((b) => {
        if (b.pickupLat == null || b.pickupLng == null) return { ...b, distanceKm: null as number | null };
        const distanceKm = this.haversineKm(lat, lng, b.pickupLat, b.pickupLng);
        return { ...b, distanceKm };
      })
      .filter((b) => b.distanceKm == null || b.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

  async getBasket(id: string) {
    const basket = await this.prisma.antiGaspiBasket.findUnique({
      where: { id },
      include: {
        merchant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            businessName: true,
            businessAddress: true,
            avatarUrl: true,
            phone: true,
            rating: true,
            isVerified: true,
          },
        },
      },
    });
    if (!basket) throw new NotFoundException('Panier introuvable');
    return basket;
  }

  // ---------------------------------------------------------------------------
  // Reservations + payment
  // ---------------------------------------------------------------------------

  async reserveBasket(basketId: string, clientId: string) {
    const basket = await this.prisma.antiGaspiBasket.findUnique({ where: { id: basketId } });
    if (!basket) throw new NotFoundException('Panier introuvable');
    if (basket.merchantId === clientId) {
      throw new BadRequestException('Vous ne pouvez pas réserver votre propre panier');
    }
    if (basket.status !== AntiGaspiBasketStatus.available) {
      throw new BadRequestException("Ce panier n'est plus disponible");
    }
    if (basket.expiresAt < new Date()) {
      throw new BadRequestException('Ce panier a expiré');
    }

    const settings = await this.getSettings();
    const expiresAt = new Date(Date.now() + settings.paymentTimeoutMinutes * 60_000);

    // Verrouillage atomique : seul un client peut passer available → reserved
    const locked = await this.prisma.antiGaspiBasket.updateMany({
      where: { id: basketId, status: AntiGaspiBasketStatus.available },
      data: { status: AntiGaspiBasketStatus.reserved },
    });
    if (locked.count === 0) {
      throw new BadRequestException("Ce panier vient d'être réservé par quelqu'un d'autre");
    }

    try {
      const reservation = await this.prisma.antiGaspiReservation.create({
        data: {
          basketId,
          clientId,
          status: AntiGaspiReservationStatus.pending_payment,
          price: basket.price,
          commissionAmount: basket.commissionAmount,
          merchantAmount: basket.merchantAmount,
          expiresAt,
        },
        include: {
          basket: {
            include: {
              merchant: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  businessName: true,
                  businessAddress: true,
                },
              },
            },
          },
          client: { select: { firstName: true } },
        },
      });

      this.notifications
        .sendToUser(basket.merchantId, {
          title: 'Réservation Anti-Gaspi',
          body: `${reservation.client?.firstName || 'Un client'} a réservé « ${basket.title} » — en attente de paiement`,
          data: { type: 'antigaspi', basketId, reservationId: reservation.id },
        })
        .catch((e) => this.logger.error(e));

      return reservation;
    } catch (err) {
      await this.prisma.antiGaspiBasket.update({
        where: { id: basketId },
        data: { status: AntiGaspiBasketStatus.available },
      });
      throw err;
    }
  }

  async getReservation(id: string, userId: string) {
    const reservation = await this.prisma.antiGaspiReservation.findUnique({
      where: { id },
      include: {
        basket: {
          include: {
            merchant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                businessName: true,
                businessAddress: true,
                phone: true,
              },
            },
          },
        },
        transactions: { orderBy: { createdAt: 'desc' } },
        payout: true,
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');

    const isClient = reservation.clientId === userId;
    const isMerchant = reservation.basket.merchantId === userId;
    if (!isClient && !isMerchant) {
      throw new ForbiddenException('Accès refusé');
    }
    return reservation;
  }

  async myReservations(clientId: string) {
    return this.prisma.antiGaspiReservation.findMany({
      where: { clientId },
      include: {
        basket: {
          include: {
            merchant: {
              select: { id: true, firstName: true, lastName: true, businessName: true },
            },
          },
        },
        transactions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async merchantReservations(merchantId: string) {
    await this.assertMerchant(merchantId);
    return this.prisma.antiGaspiReservation.findMany({
      where: {
        basket: { merchantId },
        status: {
          in: [
            AntiGaspiReservationStatus.paid,
            AntiGaspiReservationStatus.merchant_confirmed,
            AntiGaspiReservationStatus.client_confirmed,
            AntiGaspiReservationStatus.completed,
          ],
        },
      },
      include: {
        basket: true,
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lance le paiement d'une réservation. Confirmation finale via webhook
   * (sauf mock = succès immédiat).
   */
  async initiatePayment(
    reservationId: string,
    clientId: string,
    dto: InitiateAntiGaspiPaymentDto,
  ): Promise<InitiateChargeResult & { reservationId: string; transactionId: string }> {
    const reservation = await this.prisma.antiGaspiReservation.findUnique({
      where: { id: reservationId },
      include: { client: true, basket: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    if (reservation.clientId !== clientId) throw new ForbiddenException('Accès refusé');
    if (reservation.status !== AntiGaspiReservationStatus.pending_payment) {
      throw new BadRequestException("Cette réservation n'est plus en attente de paiement");
    }
    if (reservation.expiresAt && reservation.expiresAt < new Date()) {
      throw new BadRequestException('Le délai de paiement a expiré');
    }

    const tx = await this.prisma.antiGaspiTransaction.create({
      data: {
        reservationId,
        type: AntiGaspiTxType.payment,
        amount: reservation.price,
        method: dto.method,
        currency: 'XOF',
        status: AntiGaspiTxStatus.pending,
      },
    });

    const country = this.detectCountry(reservation.client?.phone, reservation.client?.country);
    const provider = this.providers.forCountry(country);

    const result = await provider.initiateCharge({
      paymentId: tx.id,
      amount: Number(reservation.price),
      currency: 'XOF',
      method: dto.method,
      country,
      customer: {
        name:
          [reservation.client?.firstName, reservation.client?.lastName].filter(Boolean).join(' ') ||
          undefined,
        phone: reservation.client?.phone,
        email: reservation.client?.email ?? undefined,
        country,
      },
      otp: dto.otp,
      successRedirectUrl: dto.successRedirectUrl,
      errorRedirectUrl: dto.errorRedirectUrl,
    });

    const newStatus =
      result.status === 'success'
        ? AntiGaspiTxStatus.success
        : result.status === 'failed'
          ? AntiGaspiTxStatus.failed
          : AntiGaspiTxStatus.processing;

    await this.prisma.antiGaspiTransaction.update({
      where: { id: tx.id },
      data: {
        provider: result.provider,
        providerRef: result.providerRef,
        status: newStatus,
      },
    });

    if (result.status === 'success') {
      await this.markPaymentSuccess(reservationId, tx.id, result.providerRef || `MOCK-${Date.now()}`);
    } else if (result.status === 'failed') {
      await this.markPaymentFailed(reservationId, tx.id);
    }

    return { ...result, reservationId, transactionId: tx.id };
  }

  /**
   * Utilise un panier Anti-Gaspi offert : le client ne paie rien,
   * Bag'up reverse ensuite le net commerçant à la clôture.
   */
  async claimGift(reservationId: string, clientId: string, rewardId: string) {
    if (!rewardId) throw new BadRequestException('Récompense requise');
    const reservation = await this.prisma.antiGaspiReservation.findUnique({
      where: { id: reservationId },
      include: { basket: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    if (reservation.clientId !== clientId) throw new ForbiddenException('Accès refusé');
    if (reservation.status !== AntiGaspiReservationStatus.pending_payment) {
      throw new BadRequestException("Cette réservation n'est plus en attente de paiement");
    }
    if (reservation.expiresAt && reservation.expiresAt < new Date()) {
      throw new BadRequestException('Le délai de paiement a expiré');
    }

    await this.loyalty.consumeGift(
      clientId,
      rewardId,
      reservationId,
      Number(reservation.price),
    );

    try {
      const tx = await this.prisma.antiGaspiTransaction.create({
        data: {
          reservationId,
          type: AntiGaspiTxType.payment,
          amount: 0,
          currency: 'XOF',
          provider: 'loyalty',
          providerRef: `LOYALTY-GIFT-${rewardId.slice(0, 8)}`,
          status: AntiGaspiTxStatus.success,
        },
      });

      await this.prisma.antiGaspiReservation.update({
        where: { id: reservationId },
        data: { loyaltyRewardId: rewardId },
      });

      await this.markPaymentSuccess(reservationId, tx.id, tx.providerRef || `LOYALTY-${Date.now()}`);

      return {
        reservationId,
        transactionId: tx.id,
        status: 'success' as const,
        fundedBy: 'loyalty',
      };
    } catch (err) {
      await this.loyalty.releaseVoucher(rewardId);
      throw err;
    }
  }

  async markPaymentSuccess(reservationId: string, transactionId: string, providerRef: string) {
    await this.prisma.$transaction([
      this.prisma.antiGaspiTransaction.update({
        where: { id: transactionId },
        data: { status: AntiGaspiTxStatus.success, providerRef },
      }),
      this.prisma.antiGaspiReservation.update({
        where: { id: reservationId },
        data: { status: AntiGaspiReservationStatus.paid },
      }),
    ]);

    const reservation = await this.prisma.antiGaspiReservation.findUnique({
      where: { id: reservationId },
      include: {
        basket: {
          select: {
            title: true,
            merchantId: true,
          },
        },
      },
    });
    if (!reservation) return;

    const title = reservation.basket?.title || 'Panier Anti-Gaspi';
    await this.notifications
      .sendToUser(reservation.clientId, {
        title: 'Paiement confirmé',
        body: `${title} — présentez-vous au commerce pour retirer`,
        data: {
          type: 'antigaspi',
          reservationId,
        },
      })
      .catch((e) => this.logger.error(e));

    if (reservation.basket?.merchantId) {
      await this.notifications
        .sendToUser(reservation.basket.merchantId, {
          title: 'Nouveau panier payé',
          body: `${title} — un client va retirer`,
          data: {
            type: 'antigaspi',
            reservationId,
          },
        })
        .catch((e) => this.logger.error(e));
    }
  }

  async markPaymentFailed(reservationId: string, transactionId: string) {
    const reservation = await this.prisma.antiGaspiReservation.findUnique({
      where: { id: reservationId },
      select: { basketId: true },
    });
    if (!reservation) return;

    await this.prisma.$transaction([
      this.prisma.antiGaspiTransaction.update({
        where: { id: transactionId },
        data: { status: AntiGaspiTxStatus.failed },
      }),
      this.prisma.antiGaspiReservation.update({
        where: { id: reservationId },
        data: { status: AntiGaspiReservationStatus.cancelled },
      }),
      this.prisma.antiGaspiBasket.updateMany({
        where: { id: reservation.basketId, status: AntiGaspiBasketStatus.reserved },
        data: { status: AntiGaspiBasketStatus.available },
      }),
    ]);
  }

  /** Applique un webhook paiement Anti-Gaspi (appelé depuis PaymentsService). */
  async applyWebhook(
    transactionId: string,
    status: ProviderChargeStatus,
    providerRef: string | undefined,
    rawBody: string,
  ): Promise<void> {
    const tx = await this.prisma.antiGaspiTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) {
      this.logger.warn(`Webhook Anti-Gaspi: transaction ${transactionId} introuvable`);
      return;
    }

    await this.prisma.antiGaspiTransaction.update({
      where: { id: tx.id },
      data: { webhookPayload: rawBody, providerRef: providerRef ?? tx.providerRef },
    });

    if (status === 'success') {
      await this.markPaymentSuccess(tx.reservationId, tx.id, providerRef || tx.providerRef || '');
    } else if (status === 'failed') {
      await this.markPaymentFailed(tx.reservationId, tx.id);
    }
  }

  /** Retrouve une transaction Anti-Gaspi par id ou providerRef (routage webhook). */
  async findTransactionByRef(paymentRef?: string, providerRef?: string) {
    if (paymentRef) {
      const byId = await this.prisma.antiGaspiTransaction.findUnique({ where: { id: paymentRef } });
      if (byId) return byId;
    }
    if (providerRef) {
      return this.prisma.antiGaspiTransaction.findFirst({ where: { providerRef } });
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Cron: expire baskets & unpaid reservations
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireBasketsCron() {
    const now = new Date();
    const result = await this.prisma.antiGaspiBasket.updateMany({
      where: {
        status: AntiGaspiBasketStatus.available,
        expiresAt: { lt: now },
      },
      data: { status: AntiGaspiBasketStatus.expired },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} panier(s) Anti-Gaspi expiré(s)`);
    }

    const expiredResas = await this.prisma.antiGaspiReservation.findMany({
      where: {
        status: AntiGaspiReservationStatus.pending_payment,
        expiresAt: { lt: now },
      },
      select: { id: true, basketId: true, clientId: true },
    });
    for (const r of expiredResas) {
      await this.prisma.$transaction([
        this.prisma.antiGaspiReservation.update({
          where: { id: r.id },
          data: { status: AntiGaspiReservationStatus.expired },
        }),
        this.prisma.antiGaspiBasket.updateMany({
          where: { id: r.basketId, status: AntiGaspiBasketStatus.reserved },
          data: { status: AntiGaspiBasketStatus.available },
        }),
      ]);
      await this.notifications
        .sendToUser(r.clientId, {
          title: 'Réservation expirée',
          body: 'Le délai de paiement Anti-Gaspi est dépassé',
          data: { type: 'antigaspi', reservationId: r.id },
        })
        .catch((e) => this.logger.error(e));
    }
    if (expiredResas.length > 0) {
      this.logger.log(`${expiredResas.length} réservation(s) non payée(s) expirée(s)`);
    }
  }

  // ---------------------------------------------------------------------------
  // Double confirmation + payout
  // ---------------------------------------------------------------------------

  /**
   * Le commerçant confirme la remise du panier.
   * Si le client a déjà confirmé → clôture + reversement.
   */
  async confirmByMerchant(reservationId: string, merchantId: string) {
    const reservation = await this.loadReservationForConfirm(reservationId);
    if (reservation.basket.merchantId !== merchantId) {
      throw new ForbiddenException('Accès refusé');
    }
    this.assertConfirmable(reservation);

    if (reservation.merchantConfirmedAt) {
      return this.getReservation(reservationId, merchantId);
    }

    const updated = await this.prisma.antiGaspiReservation.update({
      where: { id: reservationId },
      data: {
        merchantConfirmedAt: new Date(),
        status: AntiGaspiReservationStatus.merchant_confirmed,
      },
    });

    if (updated.clientConfirmedAt && updated.merchantConfirmedAt) {
      await this.completeAndPayout(reservationId);
    } else {
      await this.notifications
        .sendToUser(reservation.clientId, {
          title: 'Remise confirmée par le commerçant',
          body: 'Confirmez aussi la réception dans l’app',
          data: { type: 'antigaspi', reservationId },
        })
        .catch((e) => this.logger.error(e));
    }

    return this.getReservation(reservationId, merchantId);
  }

  /**
   * Le client confirme la réception du panier.
   * Si le commerçant a déjà confirmé → clôture + reversement.
   */
  async confirmByClient(reservationId: string, clientId: string) {
    const reservation = await this.loadReservationForConfirm(reservationId);
    if (reservation.clientId !== clientId) {
      throw new ForbiddenException('Accès refusé');
    }
    this.assertConfirmable(reservation);

    if (reservation.clientConfirmedAt) {
      return this.getReservation(reservationId, clientId);
    }

    const updated = await this.prisma.antiGaspiReservation.update({
      where: { id: reservationId },
      data: {
        clientConfirmedAt: new Date(),
        status: AntiGaspiReservationStatus.client_confirmed,
      },
    });

    if (updated.clientConfirmedAt && updated.merchantConfirmedAt) {
      await this.completeAndPayout(reservationId);
    } else {
      await this.notifications
        .sendToUser(reservation.basket.merchantId, {
          title: 'Client a confirmé la réception',
          body: 'Confirmez aussi la remise dans l’app',
          data: { type: 'antigaspi', reservationId },
        })
        .catch((e) => this.logger.error(e));
    }

    return this.getReservation(reservationId, clientId);
  }

  async merchantPayouts(merchantId: string) {
    await this.assertMerchant(merchantId);
    return this.prisma.antiGaspiPayout.findMany({
      where: { merchantId },
      include: {
        reservation: {
          include: {
            basket: { select: { id: true, title: true, price: true } },
            client: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminPayouts() {
    return this.prisma.antiGaspiPayout.findMany({
      include: {
        reservation: {
          include: {
            basket: { select: { id: true, title: true } },
            client: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async adminBaskets() {
    return this.prisma.antiGaspiBasket.findMany({
      include: {
        merchant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            businessName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async adminReservations() {
    return this.prisma.antiGaspiReservation.findMany({
      include: {
        basket: {
          select: {
            id: true,
            title: true,
            merchantId: true,
            merchant: {
              select: { id: true, firstName: true, lastName: true, businessName: true },
            },
          },
        },
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        payout: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async loadReservationForConfirm(reservationId: string) {
    const reservation = await this.prisma.antiGaspiReservation.findUnique({
      where: { id: reservationId },
      include: { basket: true, payout: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    return reservation;
  }

  private assertConfirmable(reservation: {
    status: AntiGaspiReservationStatus;
    merchantConfirmedAt: Date | null;
    clientConfirmedAt: Date | null;
  }) {
    const ok: AntiGaspiReservationStatus[] = [
      AntiGaspiReservationStatus.paid,
      AntiGaspiReservationStatus.merchant_confirmed,
      AntiGaspiReservationStatus.client_confirmed,
    ];
    if (!ok.includes(reservation.status)) {
      throw new BadRequestException(
        'Cette réservation ne peut plus être confirmée (paiement requis ou déjà clôturée)',
      );
    }
  }

  /**
   * Double confirmation atteinte → panier sold + payout net commerçant.
   * V1 : reversement mock immédiat (réel Bictorys/Stripe quand clés dispo).
   */
  private async completeAndPayout(reservationId: string) {
    const reservation = await this.prisma.antiGaspiReservation.findUnique({
      where: { id: reservationId },
      include: { basket: true, payout: true },
    });
    if (!reservation) return;
    if (reservation.status === AntiGaspiReservationStatus.completed || reservation.payout) {
      return;
    }
    if (!reservation.merchantConfirmedAt || !reservation.clientConfirmedAt) {
      return;
    }

    const amount = Number(reservation.merchantAmount);
    const providerRef = `AG-PAYOUT-MOCK-${Date.now()}`;

    // Verrou : une seule clôture gagne (anti double-payout en concurrence)
    const locked = await this.prisma.antiGaspiReservation.updateMany({
      where: {
        id: reservationId,
        status: {
          in: [
            AntiGaspiReservationStatus.paid,
            AntiGaspiReservationStatus.merchant_confirmed,
            AntiGaspiReservationStatus.client_confirmed,
          ],
        },
        merchantConfirmedAt: { not: null },
        clientConfirmedAt: { not: null },
      },
      data: { status: AntiGaspiReservationStatus.completed },
    });
    if (locked.count === 0) return;

    try {
      await this.prisma.$transaction([
        this.prisma.antiGaspiBasket.update({
          where: { id: reservation.basketId },
          data: { status: AntiGaspiBasketStatus.sold },
        }),
        this.prisma.antiGaspiPayout.create({
          data: {
            reservationId,
            merchantId: reservation.basket.merchantId,
            amount,
            currency: 'XOF',
            provider: 'mock',
            providerRef,
            status: AntiGaspiPayoutStatus.success,
            paidAt: new Date(),
          },
        }),
        this.prisma.antiGaspiTransaction.create({
          data: {
            reservationId,
            type: AntiGaspiTxType.payout,
            amount,
            currency: 'XOF',
            provider: 'mock',
            providerRef,
            status: AntiGaspiTxStatus.success,
          },
        }),
      ]);
    } catch (err) {
      this.logger.error(`Payout Anti-Gaspi échoué pour ${reservationId}`, err as Error);
      throw err;
    }

    this.logger.log(
      `Anti-Gaspi payout ${amount} XOF → merchant ${reservation.basket.merchantId} (resa ${reservationId})`,
    );

    this.loyalty.syncProgress(reservation.clientId).catch((e) => this.logger.error(e));

    const title = reservation.basket?.title || 'Panier Anti-Gaspi';
    await this.notifications
      .sendToUser(reservation.clientId, {
        title: 'Panier récupéré',
        body: `${title} — merci d’avoir lutté contre le gaspillage`,
        data: { type: 'antigaspi', reservationId },
      })
      .catch((e) => this.logger.error(e));
    await this.notifications
      .sendToUser(reservation.basket.merchantId, {
        title: 'Vente Anti-Gaspi terminée',
        body: `${title} — reversement de ${amount.toLocaleString()} FCFA`,
        data: { type: 'antigaspi', reservationId },
      })
      .catch((e) => this.logger.error(e));
  }

  /** Déduit le code pays depuis le téléphone, sinon le champ pays. */
  private detectCountry(phone?: string | null, country?: string | null): string {
    const p = (phone || '').replace(/\s/g, '');
    const byPrefix: Record<string, string> = {
      '+221': 'SN',
      '+225': 'CI',
      '+226': 'BF',
      '+223': 'ML',
      '+228': 'TG',
      '+229': 'BJ',
    };
    for (const [prefix, code] of Object.entries(byPrefix)) {
      if (p.startsWith(prefix)) return code;
    }
    const c = (country || '').trim().toLowerCase();
    if (!c) return 'SN';
    if (c.length === 2) return c.toUpperCase();
    if (c.includes('séné') || c.includes('senegal')) return 'SN';
    if (c.includes('ivoire')) return 'CI';
    return c.toUpperCase().slice(0, 2);
  }

  // ---------------------------------------------------------------------------
  // Stats (admin / merchant)
  // ---------------------------------------------------------------------------

  async merchantStats(merchantId: string) {
    await this.assertMerchant(merchantId);
    const [sold, baskets, payouts] = await Promise.all([
      this.prisma.antiGaspiBasket.count({
        where: { merchantId, status: AntiGaspiBasketStatus.sold },
      }),
      this.prisma.antiGaspiBasket.count({ where: { merchantId } }),
      this.prisma.antiGaspiPayout.aggregate({
        where: { merchantId, status: 'success' },
        _sum: { amount: true },
      }),
    ]);
    return {
      basketsPublished: baskets,
      basketsSold: sold,
      revenueReceived: Number(payouts._sum.amount || 0),
    };
  }

  /** Vue admin : stats + aperçu paniers / réservations pour une fiche commerçant. */
  async adminMerchantOverview(merchantId: string) {
    const merchant = await this.prisma.user.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        businessName: true,
        phone: true,
      },
    });
    if (!merchant || merchant.role !== UserRole.merchant) {
      throw new NotFoundException('Commerçant introuvable');
    }

    const [
      basketsPublished,
      basketsSold,
      activeCount,
      pendingPickups,
      revenueAgg,
      baskets,
      reservations,
    ] = await Promise.all([
      this.prisma.antiGaspiBasket.count({ where: { merchantId } }),
      this.prisma.antiGaspiBasket.count({
        where: { merchantId, status: AntiGaspiBasketStatus.sold },
      }),
      this.prisma.antiGaspiBasket.count({
        where: {
          merchantId,
          status: { in: [AntiGaspiBasketStatus.available, AntiGaspiBasketStatus.reserved] },
        },
      }),
      this.prisma.antiGaspiReservation.count({
        where: {
          basket: { merchantId },
          status: {
            in: [
              AntiGaspiReservationStatus.paid,
              AntiGaspiReservationStatus.merchant_confirmed,
              AntiGaspiReservationStatus.client_confirmed,
            ],
          },
        },
      }),
      this.prisma.antiGaspiPayout.aggregate({
        where: { merchantId, status: AntiGaspiPayoutStatus.success },
        _sum: { amount: true },
      }),
      this.prisma.antiGaspiBasket.findMany({
        where: { merchantId },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          price: true,
          merchantAmount: true,
          commissionAmount: true,
          status: true,
          createdAt: true,
          pickupAddress: true,
        },
      }),
      this.prisma.antiGaspiReservation.findMany({
        where: { basket: { merchantId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          basket: { select: { id: true, title: true } },
          client: { select: { id: true, firstName: true, lastName: true, phone: true } },
          payout: { select: { id: true, amount: true, status: true } },
        },
      }),
    ]);

    return {
      merchant,
      stats: {
        basketsPublished,
        basketsSold,
        activeBaskets: activeCount,
        pendingPickups,
        revenueReceived: Number(revenueAgg._sum.amount || 0),
      },
      baskets,
      reservations,
    };
  }

  async adminStats() {
    const [published, sold, expired, commissionAgg, payouts] = await Promise.all([
      this.prisma.antiGaspiBasket.count(),
      this.prisma.antiGaspiBasket.count({ where: { status: AntiGaspiBasketStatus.sold } }),
      this.prisma.antiGaspiBasket.count({ where: { status: AntiGaspiBasketStatus.expired } }),
      this.prisma.antiGaspiBasket.aggregate({
        where: { status: AntiGaspiBasketStatus.sold },
        _sum: { commissionAmount: true },
      }),
      this.prisma.antiGaspiPayout.count({ where: { status: 'success' } }),
    ]);
    return {
      basketsPublished: published,
      basketsSold: sold,
      basketsExpired: expired,
      commissionGenerated: Number(commissionAgg._sum.commissionAmount || 0),
      payoutsDone: payouts,
    };
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
}
