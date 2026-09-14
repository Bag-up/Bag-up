import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from '../dto/subscription.dto';
import { SubscriptionType, PaymentStatus, SubscriptionStatus, PaymentMethod, ShopStatus } from '@prisma/client';
import { PaymentProviderFactory } from '../payments/providers/payment-provider.factory';
import { NotificationsService } from '../notifications/notifications.service';
import { ExternalNotificationsService } from '../notifications/external-notifications.service';
import { paymentReceiptEmail } from '../notifications/email-templates';
import {
  InitiateChargeResult,
  ProviderChargeStatus,
} from '../payments/providers/payment-provider.interface';
import {
  REFERRAL_MONTHLY_CAP,
  REFERRAL_REWARD_PRO,
  rewardTypeForReferredRole,
} from '../referrals/referral-rewards';
import { DEMARCHES_SUBSCRIPTION_FCFA, isDemarchesProvider } from '../missions/demarches';

const PRICES: Record<SubscriptionType, number> = {
  registration: 5000,
  monthly: 5000,
  merchant_monthly: 6500,
};

// Seuil (en jours) de rappel avant expiration de l'abonnement.
const EXPIRY_REMINDER_DAYS = 3;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderFactory,
    private readonly notifications: NotificationsService,
    private readonly externalNotifs: ExternalNotificationsService,
  ) {}

  async create(dto: CreateSubscriptionDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (dto.type === SubscriptionType.merchant_monthly) {
      if (user.role !== 'merchant') {
        throw new BadRequestException('Abonnement boutique réservé aux commerçants');
      }
    } else if (user.role !== 'provider') {
      throw new BadRequestException('Seuls les prestataires peuvent s\'abonner');
    }

    if (dto.type === SubscriptionType.registration && user.subscriptionStatus !== SubscriptionStatus.none) {
      throw new BadRequestException('Frais d\'inscription déjà payés');
    }

    const listPrice = isDemarchesProvider(user) && dto.type !== SubscriptionType.merchant_monthly
      ? DEMARCHES_SUBSCRIPTION_FCFA
      : PRICES[dto.type];
    const requestedCredit = Math.max(0, Math.floor(dto.creditUsed ?? 0));
    const consumable = Math.min(requestedCredit, user.credit ?? 0, listPrice);
    const amount = listPrice - consumable;

    if (consumable > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { credit: { decrement: consumable } },
      });
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        type: dto.type,
        amount,
        creditUsed: consumable,
        status: PaymentStatus.pending,
        userId,
      },
    });

    return subscription;
  }

  async markSuccess(id: string, transactionId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException('Abonnement introuvable');
    if (subscription.status === PaymentStatus.success) {
      return subscription;
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { status: PaymentStatus.success, transactionId },
    });

    const user = await this.prisma.user.findUnique({ where: { id: subscription.userId } });

    const endDate = new Date();
    if (
      subscription.type === SubscriptionType.monthly ||
      subscription.type === SubscriptionType.merchant_monthly
    ) {
      // Prolongation depuis la date d'expiry restante si encore active, sinon depuis maintenant
      const currentExpiry = user?.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
      const base =
        currentExpiry && currentExpiry > new Date() ? new Date(currentExpiry) : new Date();
      base.setMonth(base.getMonth() + 1);
      endDate.setTime(base.getTime());
    } else {
      endDate.setFullYear(endDate.getFullYear() + 100);
    }

    let consecutiveMonths = 0;
    if (subscription.type === SubscriptionType.monthly) {
      const previousSubs = await this.prisma.subscription.findMany({
        where: {
          userId: subscription.userId,
          type: SubscriptionType.monthly,
          status: PaymentStatus.success,
        },
        orderBy: { createdAt: 'asc' },
      });

      consecutiveMonths = 1;
      let prevDate: Date | null = null;
      for (const sub of previousSubs) {
        if (sub.id === id) continue;
        const subDate = new Date(sub.createdAt);
        if (prevDate) {
          const diffMonths = (subDate.getFullYear() - prevDate.getFullYear()) * 12 + (subDate.getMonth() - prevDate.getMonth());
          if (diffMonths <= 1) {
            consecutiveMonths++;
          } else {
            consecutiveMonths = 1;
          }
        }
        prevDate = subDate;
      }
      consecutiveMonths++;
    }

    const insuranceEligible = consecutiveMonths >= 4;

    await this.prisma.user.update({
      where: { id: subscription.userId },
      data: {
        subscriptionStatus: SubscriptionStatus.active,
        subscriptionExpiry: endDate,
      },
    });

    if (subscription.type === SubscriptionType.merchant_monthly) {
      await this.prisma.shop.updateMany({
        where: {
          ownerId: subscription.userId,
          status: { in: [ShopStatus.draft, ShopStatus.hidden] },
        },
        data: { status: ShopStatus.active },
      });
    }

    // Récompense de parrainage prestataire: 1 mois offert au parrain lorsque le
    // filleul prestataire a réglé 2 mois d'abonnement (cf. CDC §Parrainage).
    if (subscription.type === SubscriptionType.monthly) {
      this.processProviderReferralReward(subscription.userId).catch(() => {});
    }

    if (user?.email) {
      const typeLabel: Record<string, string> = {
        registration: 'Adhésion prestataire',
        monthly: 'Abonnement mensuel prestataire',
        merchant_monthly: 'Abonnement boutique',
      };
      const mail = paymentReceiptEmail({
        firstName: user.firstName,
        amount: Number(subscription.amount),
        currency: subscription.currency === 'XOF' || !subscription.currency ? 'FCFA' : subscription.currency,
        method: null,
        transactionId: transactionId || subscription.transactionId,
        kind: 'subscription',
        label: typeLabel[subscription.type] || 'Abonnement',
      });
      this.externalNotifs
        .sendEmail(user.email, mail.subject, mail.html)
        .catch((err) => this.logger.error('Subscription receipt email failed:', err));
    }

    return { ...updated, consecutiveMonths, insuranceEligible };
  }

  /**
   * Crédite 1000 FCFA au parrain lorsque son filleul presta/commerçant a payé
   * son 1er abonnement avec succès. Idempotent via rewardStatus="rewarded".
   */
  private async processProviderReferralReward(referredUserId: string) {
    const referral = await this.prisma.referral.findFirst({
      where: { referredId: referredUserId, rewardStatus: 'pending' },
    });
    if (!referral) return;
    if (referral.fraudFlag) return;

    const referred = await this.prisma.user.findUnique({
      where: { id: referredUserId },
      select: { role: true },
    });
    if (!referred || (referred.role !== 'provider' && referred.role !== 'merchant')) {
      return;
    }

    const paidSubs = await this.prisma.subscription.count({
      where: {
        userId: referredUserId,
        status: PaymentStatus.success,
      },
    });
    // 1er abo payé uniquement
    if (paidSubs > 1) return;

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

    await this.prisma.$transaction([
      this.prisma.referral.update({
        where: { id: referral.id },
        data: {
          rewardStatus: 'rewarded',
          rewardType: rewardTypeForReferredRole(referred.role),
        },
      }),
      this.prisma.user.update({
        where: { id: referral.referrerId },
        data: { credit: { increment: REFERRAL_REWARD_PRO } },
      }),
    ]);

    this.logger.log(
      `Referral reward ${REFERRAL_REWARD_PRO} FCFA credited to ${referral.referrerId} (filleul ${referred.role} ${referredUserId})`,
    );
  }

  async markFailed(id: string) {
    return this.prisma.subscription.update({
      where: { id },
      data: { status: PaymentStatus.failed },
    });
  }

  /**
   * Lance le paiement de l'abonnement auprès de la passerelle adaptée.
   * La confirmation finale arrive via webhook (applyWebhook), sauf en mode mock
   * où le succès est immédiat.
   */
  async initiate(
    subscriptionId: string,
    opts: {
      method: PaymentMethod;
      otp?: string;
      successRedirectUrl?: string;
      errorRedirectUrl?: string;
    },
  ): Promise<InitiateChargeResult & { subscriptionId: string }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });
    if (!subscription) throw new NotFoundException('Abonnement introuvable');

    // Entièrement couvert par le crédit wallet → pas de passerelle.
    if (Number(subscription.amount) <= 0) {
      await this.markSuccess(subscription.id, `CREDIT-${Date.now()}`);
      return {
        status: 'success',
        provider: 'credit',
        providerRef: `CREDIT-${subscription.id}`,
        subscriptionId: subscription.id,
      };
    }

    const country = this.detectCountry(subscription.user?.phone, subscription.user?.country);
    const provider = this.providers.forCountry(country);

    const result = await provider.initiateCharge({
      paymentId: subscription.id,
      amount: Number(subscription.amount),
      currency: subscription.currency || 'XOF',
      method: opts.method,
      country,
      customer: {
        name: [subscription.user?.firstName, subscription.user?.lastName].filter(Boolean).join(' ') || undefined,
        phone: subscription.user?.phone,
        email: subscription.user?.email ?? undefined,
        country,
      },
      otp: opts.otp,
      successRedirectUrl: opts.successRedirectUrl,
      errorRedirectUrl: opts.errorRedirectUrl,
    });

    await this.prisma.subscription.update({
      where: { id: subscription.id },
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

    // MockProvider confirme immédiatement → activer l'abonnement.
    if (result.status === 'success') {
      await this.markSuccess(subscription.id, result.providerRef || `MOCK-${Date.now()}`);
    }

    return { ...result, subscriptionId: subscription.id };
  }

  /**
   * Applique le statut reçu via webhook à un abonnement (appelé par
   * PaymentsService.handleWebhook quand la référence correspond à un abonnement).
   */
  async applyWebhook(
    subscriptionId: string,
    status: ProviderChargeStatus,
    providerRef: string | undefined,
    rawBody: string,
  ): Promise<void> {
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { webhookPayload: rawBody, providerRef },
    });
    if (status === 'success') {
      await this.markSuccess(subscriptionId, providerRef || '');
    } else if (status === 'failed') {
      await this.markFailed(subscriptionId);
    }
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

  async findByUser(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    const rows = await this.prisma.subscription.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((s) => {
      let gatewayStatus: string | null = null;
      let paymentChannel: string | null = null;
      let pspName: string | null = null;
      if (s.webhookPayload) {
        try {
          const payload = JSON.parse(s.webhookPayload) as Record<string, unknown>;
          gatewayStatus = typeof payload.status === 'string' ? payload.status : null;
          paymentChannel =
            typeof payload.paymentChannel === 'string' ? payload.paymentChannel : null;
          pspName = typeof payload.pspName === 'string' ? payload.pspName : null;
        } catch {
          // ignore malformed webhook JSON
        }
      }
      return {
        ...s,
        gatewayStatus,
        paymentChannel,
        pspName,
        // Ne pas renvoyer le payload brut à l’admin (bruit + PII)
        webhookPayload: undefined,
      };
    });
  }

  async checkExpiry() {
    const expired = await this.prisma.user.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.active,
        subscriptionExpiry: { lt: new Date() },
      },
      select: { id: true },
    });

    if (expired.length > 0) {
      await this.prisma.user.updateMany({
        where: { id: { in: expired.map(u => u.id) } },
        data: { subscriptionStatus: SubscriptionStatus.expired },
      });
    }

    return expired.length;
  }

  /**
   * Tâche quotidienne : marque les abonnements échus comme "expired" (avec
   * notification) et prévient les prestataires dont l'abonnement expire bientôt.
   * S'exécute chaque jour à 08:00 (heure serveur).
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleSubscriptionExpiryCron(): Promise<void> {
    const now = new Date();

    // 1) Expirer les abonnements échus + notifier.
    const expired = await this.prisma.user.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.active,
        subscriptionExpiry: { lt: now },
      },
      select: { id: true },
    });

    if (expired.length > 0) {
      const ids = expired.map((u) => u.id);
      await this.prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { subscriptionStatus: SubscriptionStatus.expired },
      });
      // Marketplace : masquer les boutiques des commerçants dont l'abo a expiré
      await this.prisma.shop.updateMany({
        where: { ownerId: { in: ids }, status: ShopStatus.active },
        data: { status: ShopStatus.hidden },
      });
      await this.notifications.sendToUsers(ids, {
        title: 'Abonnement expiré',
        body: 'Votre abonnement a expiré. Renouvelez-le pour continuer à recevoir des missions.',
        data: { type: 'subscription_expiring' },
      });
      this.logger.log(`${expired.length} abonnement(s) expiré(s)`);
    }

    // 2) Prévenir les prestataires dont l'abonnement expire dans <= 3 jours.
    const soon = new Date(now.getTime() + EXPIRY_REMINDER_DAYS * 24 * 60 * 60 * 1000);
    const expiringSoon = await this.prisma.user.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.active,
        subscriptionExpiry: { gte: now, lte: soon },
      },
      select: { id: true, subscriptionExpiry: true },
    });

    for (const u of expiringSoon) {
      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(u.subscriptionExpiry!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      );
      await this.notifications.notifySubscriptionExpiring(u.id, daysLeft);
    }
    if (expiringSoon.length > 0) {
      this.logger.log(`${expiringSoon.length} rappel(s) d'expiration envoyé(s)`);
    }
  }

  async getStats() {
    const total = await this.prisma.subscription.aggregate({
      where: { status: PaymentStatus.success },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const activeCount = await this.prisma.user.count({
      where: { subscriptionStatus: SubscriptionStatus.active },
    });

    const unpaidVerified = await this.getUnpaidVerified();

    return {
      totalRevenue: total._sum.amount || 0,
      totalSubscriptions: total._count._all,
      activeProviders: activeCount,
      unpaidVerifiedCount: unpaidVerified.length,
    };
  }

  /**
   * Prestataires (toujours) et commerçants marketplace validés
   * sans aucun paiement d'abonnement réussi — à relancer.
   */
  async getUnpaidVerified() {
    const users = await this.prisma.user.findMany({
      where: {
        isVerified: true,
        role: { in: ['provider', 'merchant'] },
        subscriptions: { none: { status: PaymentStatus.success } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        businessName: true,
        zone: true,
        subscriptionStatus: true,
        merchantChannels: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users
      .filter((u) => {
        if (u.role === 'provider') return true;
        const channels = u.merchantChannels || [];
        // Anti-Gaspi seul : pas d'abo obligatoire
        if (channels.length > 0 && !channels.includes('marketplace')) return false;
        return true;
      })
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        role: u.role,
        businessName: u.businessName,
        zone: u.zone,
        subscriptionStatus: u.subscriptionStatus,
        createdAt: u.createdAt,
        expectedFee: u.role === 'merchant' ? 6500 : 5000,
        expectedLabel: u.role === 'merchant' ? 'Abonnement boutique' : "Frais d'adhésion",
      }));
  }

  async getActiveSubscriptions() {
    const providers = await this.prisma.user.findMany({
      where: {
        role: 'provider',
        subscriptionStatus: { in: [SubscriptionStatus.active, SubscriptionStatus.expired] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
        isVerified: true,
        zone: true,
        subscriptions: {
          where: { type: SubscriptionType.monthly, status: PaymentStatus.success },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        },
      },
      orderBy: { subscriptionExpiry: 'asc' },
    });

    return providers.map((p) => {
      const now = new Date();
      const expiry = p.subscriptionExpiry ? new Date(p.subscriptionExpiry) : null;
      const daysLeft = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

      let consecutiveMonths = 0;
      let prevDate: Date | null = null;
      for (const sub of p.subscriptions) {
        const subDate = new Date(sub.createdAt);
        if (prevDate) {
          const diffMonths = (subDate.getFullYear() - prevDate.getFullYear()) * 12 + (subDate.getMonth() - prevDate.getMonth());
          if (diffMonths <= 1) {
            consecutiveMonths++;
          } else {
            consecutiveMonths = 1;
          }
        } else {
          consecutiveMonths = 1;
        }
        prevDate = subDate;
      }

      return {
        ...p,
        daysLeft,
        isExpiringSoon: daysLeft !== null && daysLeft <= 7 && daysLeft > 0,
        isExpired: daysLeft !== null && daysLeft <= 0,
        consecutiveMonths,
        insuranceEligible: consecutiveMonths >= 4,
      };
    });
  }
}
