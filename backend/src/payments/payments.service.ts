import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { InitiateChargeResult } from './providers/payment-provider.interface';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AntiGaspiService } from '../anti-gaspi/anti-gaspi.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { ExternalNotificationsService } from '../notifications/external-notifications.service';
import { paymentReceiptEmail, PaymentReceiptKind } from '../notifications/email-templates';
import { RidesService } from '../rides/rides.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  REFERRAL_MONTHLY_CAP,
  rewardForReferredRole,
  rewardTypeForReferredRole,
} from '../referrals/referral-rewards';

const paymentInclude = {
  mission: true,
  ride: true,
} as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderFactory,
    private readonly subscriptions: SubscriptionsService,
    private readonly antiGaspi: AntiGaspiService,
    private readonly marketplace: MarketplaceService,
    private readonly externalNotifs: ExternalNotificationsService,
    private readonly rides: RidesService,
    private readonly loyalty: LoyaltyService,
  ) {}

  async create(dto: CreatePaymentDto, userId: string) {
    const hasMission = !!dto.missionId;
    const hasRide = !!dto.rideId;
    if (hasMission === hasRide) {
      throw new BadRequestException('Indiquez missionId ou rideId (un seul)');
    }

    if (hasRide) {
      throw new BadRequestException(
        'Les courses se paient en espèces directement au chauffeur. Le chauffeur confirme ensuite la réception dans l’application.',
      );
    }

    const { creditUsed, loyaltyRewardId, ...paymentData } = dto;
    // Consommer le crédit de parrainage si demandé (plafonné au solde disponible)
    if (creditUsed && creditUsed > 0) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { credit: true },
      });
      const consumable = Math.min(creditUsed, user?.credit ?? 0);
      if (consumable > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { credit: { decrement: consumable } },
        });
      }
    }
    let appliedRewardId: string | null = null;
    if (loyaltyRewardId) {
      const reward = await this.loyalty.consumeVoucher(
        userId,
        loyaltyRewardId,
        hasRide ? 'ride' : 'mission',
        (dto.rideId || dto.missionId) as string,
      );
      appliedRewardId = reward.id;
    }
    return this.prisma.payment.create({
      data: {
        amount: paymentData.amount,
        method: paymentData.method,
        transactionId: paymentData.transactionId,
        missionId: paymentData.missionId || null,
        rideId: paymentData.rideId || null,
        loyaltyRewardId: appliedRewardId,
        userId,
        status: PaymentStatus.pending,
      },
      include: paymentInclude,
    });
  }

  async findByUser(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.payment.findMany({
      include: {
        ...paymentInclude,
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: { ...paymentInclude, user: true },
    });
  }

  async markSuccess(id: string, transactionId: string) {
    const payment = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.success, transactionId },
      include: { ...paymentInclude, user: true },
    });
    // Débloquer la récompense de parrainage après la 1ère prestation payante du filleul
    this.processReferralReward(payment.userId).catch((err) =>
      this.logger.error('Referral reward processing failed:', err),
    );
    // Marketplace : passer la commande en « en attente de préparation »
    this.marketplace.applyPaymentSuccess(id).catch((err) =>
      this.logger.error('Marketplace payment apply failed:', err),
    );
    if (payment.rideId) {
      this.rides.applyPaymentSuccess(payment.rideId).catch((err) =>
        this.logger.error('Ride payout apply failed:', err),
      );
    }
    this.sendPaymentReceiptEmail(payment).catch((err) =>
      this.logger.error('Payment receipt email failed:', err),
    );
    return payment;
  }

  private async sendPaymentReceiptEmail(payment: {
    amount: unknown;
    method?: string | null;
    transactionId?: string | null;
    currency?: string | null;
    missionId?: string | null;
    rideId?: string | null;
    user?: { email?: string | null; firstName?: string | null } | null;
    mission?: { serviceType?: string | null; serviceDetails?: unknown } | null;
    ride?: { vehicleMode?: string | null } | null;
  }) {
    const email = payment.user?.email;
    if (!email) return;

    const details =
      payment.mission?.serviceDetails && typeof payment.mission.serviceDetails === 'object'
        ? (payment.mission.serviceDetails as Record<string, unknown>)
        : {};
    let kind: PaymentReceiptKind = 'mission';
    let label: string | null = payment.mission?.serviceType
      ? `Mission ${payment.mission.serviceType}`
      : null;
    if (payment.rideId) {
      kind = 'mission';
      label = `Course ${payment.ride?.vehicleMode || ''}`.trim();
    } else if (details.marketplaceOrderId) {
      kind = 'marketplace';
      label = 'Commande marketplace';
    }

    const mail = paymentReceiptEmail({
      firstName: payment.user?.firstName,
      amount: Number(payment.amount),
      currency: payment.currency === 'XOF' || !payment.currency ? 'FCFA' : payment.currency,
      method: payment.method,
      transactionId: payment.transactionId,
      kind,
      label,
    });
    await this.externalNotifs.sendEmail(email, mail.subject, mail.html);
  }

  /**
   * Débloque la récompense de parrainage lorsqu'un filleul réalise sa première
   * prestation payante. Idempotent (rewardStatus passe à "rewarded") et borné par
   * un plafond mensuel par parrain (anti-fraude).
   * Montants: client → 500 F au parrain ; presta/commerçant → 1000 F (via abo).
   */
  private async processReferralReward(userId: string) {
    const referral = await this.prisma.referral.findFirst({
      where: { referredId: userId, rewardStatus: 'pending' },
    });
    if (!referral) return;
    if (referral.fraudFlag) {
      this.logger.warn(`Referral ${referral.id} flagged as fraud — reward skipped`);
      return;
    }

    const referred = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!referred) return;
    // Les récompenses presta/commerçant sont gérées à l'abonnement
    if (referred.role === 'provider' || referred.role === 'merchant') return;

    // 1ère prestation payante uniquement
    const successCount = await this.prisma.payment.count({
      where: { userId, status: PaymentStatus.success },
    });
    if (successCount > 1) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const rewardedThisMonth = await this.prisma.referral.count({
      where: {
        referrerId: referral.referrerId,
        rewardStatus: 'rewarded',
        createdAt: { gte: startOfMonth },
      },
    });
    if (rewardedThisMonth >= REFERRAL_MONTHLY_CAP) {
      this.logger.warn(`Referral monthly cap reached for ${referral.referrerId}`);
      return;
    }

    const amount = rewardForReferredRole(referred.role);
    const rewardType = rewardTypeForReferredRole(referred.role);

    await this.prisma.$transaction([
      this.prisma.referral.update({
        where: { id: referral.id },
        data: { rewardStatus: 'rewarded', rewardType },
      }),
      this.prisma.user.update({
        where: { id: referral.referrerId },
        data: { credit: { increment: amount } },
      }),
    ]);

    this.logger.log(
      `Referral reward ${amount} FCFA credited to ${referral.referrerId} (filleul client ${userId})`,
    );
  }

  async markFailed(id: string) {
    const payment = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.failed },
      include: { ...paymentInclude, user: true },
    });
    await this.loyalty.releaseVoucher(payment.loyaltyRewardId).catch((err) =>
      this.logger.error('Loyalty voucher restore failed:', err),
    );
    return payment;
  }

  /**
   * Lance le paiement auprès de la passerelle adaptée (Bictorys / Stripe / mock).
   * Renvoie les éléments d'UI nécessaires côté mobile (deep link Wave, QR code,
   * page checkout carte, message USSD...). La confirmation finale arrive ensuite
   * via webhook (handleWebhook).
   */
  async initiate(
    paymentId: string,
    opts: { otp?: string; successRedirectUrl?: string; errorRedirectUrl?: string } = {},
  ): Promise<InitiateChargeResult & { paymentId: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });
    if (!payment) throw new Error('Paiement introuvable');

    const country = this.detectCountry(payment.user?.phone, payment.user?.country);
    const provider = this.providers.forCountry(country);

    const result = await provider.initiateCharge({
      paymentId: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency || 'XOF',
      method: payment.method,
      country,
      customer: {
        name: [payment.user?.firstName, payment.user?.lastName].filter(Boolean).join(' ') || undefined,
        phone: payment.user?.phone,
        email: payment.user?.email ?? undefined,
        country,
      },
      otp: opts.otp,
      successRedirectUrl:
        opts.successRedirectUrl ||
        process.env.PAYMENT_SUCCESS_URL ||
        'https://admin.bagup.app/payment/success',
      errorRedirectUrl:
        opts.errorRedirectUrl ||
        process.env.PAYMENT_ERROR_URL ||
        'https://admin.bagup.app/payment/error',
    });

    const newStatus =
      result.status === 'success'
        ? PaymentStatus.success
        : result.status === 'failed'
          ? PaymentStatus.failed
          : PaymentStatus.processing;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider: result.provider,
        providerRef: result.providerRef,
        status: newStatus,
      },
    });

    // Le MockProvider confirme immédiatement → déclencher la récompense parrainage.
    if (newStatus === PaymentStatus.success) {
      this.processReferralReward(payment.userId).catch((err) =>
        this.logger.error('Referral reward processing failed:', err),
      );
    }

    return { ...result, paymentId: payment.id };
  }

  /**
   * Traite un webhook de paiement (Bictorys/Stripe). Idempotent : un même
   * événement n'est traité qu'une seule fois. La signature est validée par la
   * passerelle correspondante. Vérifie aussi la cohérence montant/devise.
   */
  async handleWebhook(
    providerName: string,
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): Promise<void> {
    const provider = this.providers.byName(providerName);
    if (!provider) {
      this.logger.warn(`Webhook reçu pour une passerelle inconnue: ${providerName}`);
      return;
    }

    if (!provider.verifyWebhook(rawBody, headers)) {
      this.logger.warn(`Signature webhook invalide (${providerName})`);
      return;
    }

    const event = provider.parseWebhook(rawBody);
    if (!event.eventId) {
      this.logger.warn(`Webhook ${providerName} sans identifiant d'événement`);
      return;
    }

    // Idempotence : on enregistre l'événement; un doublon lève une erreur unique.
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: providerName,
          eventId: event.eventId,
          status: event.status,
          payload: rawBody,
        },
      });
    } catch {
      this.logger.log(`Webhook ${providerName} déjà traité (${event.eventId}) — ignoré`);
      return;
    }

    // Retrouver le paiement par référence marchande (id) ou par référence passerelle.
    const payment = event.paymentRef
      ? await this.prisma.payment.findUnique({ where: { id: event.paymentRef } })
      : event.providerRef
        ? await this.prisma.payment.findFirst({ where: { providerRef: event.providerRef } })
        : null;

    if (!payment) {
      // La référence peut correspondre à un abonnement prestataire (même URL de webhook).
      const subscription = event.paymentRef
        ? await this.prisma.subscription.findUnique({ where: { id: event.paymentRef } })
        : event.providerRef
          ? await this.prisma.subscription.findFirst({ where: { providerRef: event.providerRef } })
          : null;

      if (subscription) {
        if (
          event.amount !== undefined &&
          Math.round(Number(subscription.amount)) !== Math.round(event.amount)
        ) {
          this.logger.error(
            `Webhook ${providerName}: montant abonnement incohérent (attendu ${subscription.amount}, reçu ${event.amount})`,
          );
          return;
        }
        await this.subscriptions.applyWebhook(
          subscription.id,
          event.status,
          event.providerRef,
          rawBody,
        );
        return;
      }

      // Ou une transaction Anti-Gaspi
      const agTx = await this.antiGaspi.findTransactionByRef(event.paymentRef, event.providerRef);
      if (agTx) {
        if (
          event.amount !== undefined &&
          Math.round(Number(agTx.amount)) !== Math.round(event.amount)
        ) {
          this.logger.error(
            `Webhook ${providerName}: montant Anti-Gaspi incohérent (attendu ${agTx.amount}, reçu ${event.amount})`,
          );
          return;
        }
        await this.antiGaspi.applyWebhook(agTx.id, event.status, event.providerRef, rawBody);
        return;
      }

      this.logger.warn(`Webhook ${providerName}: référence introuvable (${event.paymentRef})`);
      return;
    }

    // Anti-fraude : le montant et la devise doivent correspondre à la commande.
    if (
      event.amount !== undefined &&
      Math.round(Number(payment.amount)) !== Math.round(event.amount)
    ) {
      this.logger.error(
        `Webhook ${providerName}: montant incohérent (attendu ${payment.amount}, reçu ${event.amount})`,
      );
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { webhookPayload: rawBody, providerRef: event.providerRef ?? payment.providerRef },
    });

    if (event.status === 'success') {
      await this.markSuccess(payment.id, event.providerRef || payment.providerRef || '');
    } else if (event.status === 'failed') {
      await this.markFailed(payment.id);
    }
  }

  /** Déduit le code pays Bictorys/ISO depuis le téléphone, sinon le champ pays. */
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
    // Tout autre pays (diaspora) → routé vers Stripe.
    return c.toUpperCase().slice(0, 2);
  }
}
