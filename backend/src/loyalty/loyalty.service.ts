import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AntiGaspiReservationStatus,
  LoyaltyRewardStatus,
  LoyaltyRewardType,
  MarketplaceOrderStatus,
  MissionStatus,
  Prisma,
  RideStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ANTIGASPI_GIFT_MAX_XOF,
  addDays,
  currentMonthKey,
  LOYALTY_TIERS,
  nextTier,
  tierForCount,
  VOUCHER_VALIDITY_DAYS,
} from './loyalty-tiers';

type Tx = Prisma.TransactionClient;

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getStatus(userId: string) {
    await this.syncProgress(userId);
    return this.buildStatus(userId);
  }

  async adminOverview() {
    const [users, rewards, byTier] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: UserRole.client },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          loyaltyCompletedCount: true,
          loyaltyTier: true,
          loyaltyGoldMonthKey: true,
        },
        orderBy: { loyaltyCompletedCount: 'desc' },
        take: 200,
      }),
      this.prisma.loyaltyReward.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      this.prisma.user.groupBy({
        by: ['loyaltyTier'],
        where: { role: UserRole.client },
        _count: { _all: true },
      }),
    ]);

    const tierCounts = Object.fromEntries(
      LOYALTY_TIERS.map((t) => [t.level, 0]),
    ) as Record<number, number>;
    for (const row of byTier) {
      tierCounts[row.loyaltyTier] = row._count._all;
    }

    return {
      tiers: LOYALTY_TIERS,
      tierCounts,
      clients: users.map((u) => ({
        ...u,
        tier: tierForCount(u.loyaltyCompletedCount),
      })),
      recentRewards: rewards,
    };
  }

  /**
   * Recalcule le compteur et attribue les récompenses des paliers franchis.
   * Appelé à chaque activité terminée et à l'ouverture de « Ma fidélité ».
   */
  async syncProgress(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== UserRole.client) return null;

    const count = await this.countCompleted(userId);

    const granted = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { loyaltyCompletedCount: true, loyaltyTier: true },
      });
      if (!current) return [] as string[];

      const newTier = tierForCount(count);
      const oldTier = current.loyaltyTier || 1;
      const newlyReached = LOYALTY_TIERS.filter(
        (t) => t.level > oldTier && t.level <= newTier.level,
      );

      if (count !== current.loyaltyCompletedCount || newTier.level !== oldTier) {
        await tx.user.update({
          where: { id: userId },
          data: {
            loyaltyCompletedCount: count,
            loyaltyTier: newTier.level,
          },
        });
      }

      const created: string[] = [];
      for (const tier of newlyReached) {
        const ids = await this.grantLevelUpRewards(tx, userId, tier.level);
        created.push(...ids);
      }
      return created;
    });

    if (granted.length > 0) {
      const tier = tierForCount(count);
      this.notifications
        .sendToUser(userId, {
          title: `Niveau ${tier.name} débloqué !`,
          body: `Vous avez ${count} activité${count > 1 ? 's' : ''} terminée${count > 1 ? 's' : ''}. Vos récompenses sont disponibles.`,
          data: { type: 'loyalty', tier: String(tier.level) },
        })
        .catch((err) => this.logger.error('Loyalty notify failed', err));
    }

    return { count, granted };
  }

  async consumeVoucher(
    userId: string,
    rewardId: string,
    usedOnType: string,
    usedOnId: string,
  ) {
    const reward = await this.prisma.loyaltyReward.findUnique({ where: { id: rewardId } });
    if (!reward || reward.userId !== userId) {
      throw new BadRequestException('Bon fidélité introuvable');
    }
    if (reward.type !== LoyaltyRewardType.voucher) {
      throw new BadRequestException("Cette récompense n'est pas un bon");
    }
    this.assertUsable(reward);

    await this.prisma.loyaltyReward.update({
      where: { id: rewardId },
      data: {
        status: LoyaltyRewardStatus.used,
        usedAt: new Date(),
        usedOnType,
        usedOnId,
      },
    });
    return reward;
  }

  async releaseVoucher(rewardId: string | null | undefined) {
    if (!rewardId) return;
    await this.prisma.loyaltyReward.updateMany({
      where: { id: rewardId, status: LoyaltyRewardStatus.used },
      data: {
        status: LoyaltyRewardStatus.available,
        usedAt: null,
        usedOnType: null,
        usedOnId: null,
      },
    });
  }

  async consumeGift(
    userId: string,
    rewardId: string,
    reservationId: string,
    basketPrice: number,
  ) {
    const reward = await this.prisma.loyaltyReward.findUnique({ where: { id: rewardId } });
    if (!reward || reward.userId !== userId) {
      throw new BadRequestException('Cadeau Anti-Gaspi introuvable');
    }
    if (reward.type !== LoyaltyRewardType.antigaspi_gift) {
      throw new BadRequestException("Cette récompense n'est pas un panier offert");
    }
    this.assertUsable(reward);
    if (basketPrice > reward.amount) {
      throw new BadRequestException(
        `Ce panier dépasse le plafond du cadeau (${reward.amount.toLocaleString()} FCFA)`,
      );
    }

    await this.prisma.loyaltyReward.update({
      where: { id: rewardId },
      data: {
        status: LoyaltyRewardStatus.used,
        usedAt: new Date(),
        usedOnType: 'reservation',
        usedOnId: reservationId,
      },
    });
    return reward;
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async grantGoldMonthlyCron() {
    const monthKey = currentMonthKey();
    const goldUsers = await this.prisma.user.findMany({
      where: {
        role: UserRole.client,
        loyaltyTier: 5,
        OR: [{ loyaltyGoldMonthKey: null }, { loyaltyGoldMonthKey: { not: monthKey } }],
      },
      select: { id: true },
    });
    if (goldUsers.length === 0) return;

    let granted = 0;
    for (const user of goldUsers) {
      try {
        await this.grantGoldMonthly(user.id, monthKey);
        granted++;
      } catch (err) {
        this.logger.error(`Gold monthly failed for ${user.id}`, err as Error);
      }
    }
    this.logger.log(`Bons Gold mensuels : ${granted}/${goldUsers.length} (${monthKey})`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireRewardsCron() {
    const result = await this.prisma.loyaltyReward.updateMany({
      where: {
        status: LoyaltyRewardStatus.available,
        expiresAt: { lt: new Date() },
      },
      data: { status: LoyaltyRewardStatus.expired },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} récompense(s) fidélité expirée(s)`);
    }
  }

  private async grantGoldMonthly(userId: string, monthKey: string) {
    const gold = LOYALTY_TIERS[4];
    const expiresAt = addDays(new Date(), VOUCHER_VALIDITY_DAYS);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { loyaltyGoldMonthKey: true, loyaltyTier: true },
      });
      if (!user || user.loyaltyTier < 5 || user.loyaltyGoldMonthKey === monthKey) return;

      const already = await tx.loyaltyReward.count({
        where: {
          userId,
          source: 'gold_monthly',
          createdAt: { gte: new Date(`${monthKey}-01T00:00:00.000Z`) },
        },
      });
      if (already > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { loyaltyGoldMonthKey: monthKey },
        });
        return;
      }

      await tx.loyaltyReward.createMany({
        data: [
          {
            userId,
            type: LoyaltyRewardType.voucher,
            amount: gold.voucherAmount,
            tier: 5,
            source: 'gold_monthly',
            expiresAt,
          },
          {
            userId,
            type: LoyaltyRewardType.antigaspi_gift,
            amount: ANTIGASPI_GIFT_MAX_XOF,
            tier: 5,
            source: 'gold_monthly',
            expiresAt,
          },
        ],
      });
      await tx.user.update({
        where: { id: userId },
        data: { loyaltyGoldMonthKey: monthKey },
      });
    });

    this.notifications
      .sendToUser(userId, {
        title: 'Vos avantages Gold du mois',
        body: `Bon de ${gold.voucherAmount.toLocaleString()} FCFA + panier Anti-Gaspi offert, valables 30 jours.`,
        data: { type: 'loyalty', source: 'gold_monthly' },
      })
      .catch((err) => this.logger.error(err));
  }

  private async grantLevelUpRewards(tx: Tx, userId: string, tierLevel: number) {
    const tier = LOYALTY_TIERS.find((t) => t.level === tierLevel);
    if (!tier) return [];

    const existing = await tx.loyaltyReward.findMany({
      where: { userId, tier: tierLevel, source: 'level_up' },
      select: { type: true },
    });
    const hasType = new Set(existing.map((r) => r.type));
    const expiresAt = addDays(new Date(), VOUCHER_VALIDITY_DAYS);
    const created: string[] = [];

    if (tier.voucherAmount > 0 && !hasType.has(LoyaltyRewardType.voucher)) {
      const row = await tx.loyaltyReward.create({
        data: {
          userId,
          type: LoyaltyRewardType.voucher,
          amount: tier.voucherAmount,
          tier: tierLevel,
          source: 'level_up',
          expiresAt,
        },
      });
      created.push(row.id);
    }
    if (tier.antigaspiGift && !hasType.has(LoyaltyRewardType.antigaspi_gift)) {
      const row = await tx.loyaltyReward.create({
        data: {
          userId,
          type: LoyaltyRewardType.antigaspi_gift,
          amount: ANTIGASPI_GIFT_MAX_XOF,
          tier: tierLevel,
          source: 'level_up',
          expiresAt,
        },
      });
      created.push(row.id);
    }

    if (tier.monthly) {
      const monthKey = currentMonthKey();
      await tx.user.update({
        where: { id: userId },
        data: { loyaltyGoldMonthKey: monthKey },
      });
    }
    return created;
  }

  private async countCompleted(userId: string) {
    const [missions, rides, antiGaspi, marketplace] = await Promise.all([
      this.prisma.mission.count({
        where: {
          clientId: userId,
          status: { in: [MissionStatus.delivered, MissionStatus.returned_to_client] },
        },
      }),
      this.prisma.ride.count({
        where: { passengerId: userId, status: RideStatus.completed },
      }),
      this.prisma.antiGaspiReservation.count({
        where: { clientId: userId, status: AntiGaspiReservationStatus.completed },
      }),
      this.prisma.marketplaceOrder.count({
        where: {
          buyerId: userId,
          status: MarketplaceOrderStatus.delivered,
          missionId: null,
        },
      }),
    ]);
    return missions + rides + antiGaspi + marketplace;
  }

  private async buildStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        loyaltyCompletedCount: true,
        loyaltyTier: true,
        loyaltyGoldMonthKey: true,
      },
    });
    const count = user?.loyaltyCompletedCount ?? 0;
    const current = tierForCount(count);
    const upcoming = nextTier(current.level);
    const prevMin = current.minCompleted;
    const nextMin = upcoming?.minCompleted ?? current.minCompleted;
    const span = Math.max(1, nextMin - prevMin);
    const progressPercent = upcoming
      ? Math.min(100, Math.round(((count - prevMin) / span) * 100))
      : 100;

    const rewards = await this.prisma.loyaltyReward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const available = rewards.filter((r) => r.status === LoyaltyRewardStatus.available);
    const now = new Date();
    for (const r of available) {
      if (r.expiresAt && r.expiresAt < now) {
        r.status = LoyaltyRewardStatus.expired;
      }
    }

    return {
      completedCount: count,
      remainingToNext: upcoming ? Math.max(0, upcoming.minCompleted - count) : 0,
      progressPercent,
      currentTier: current,
      nextTier: upcoming,
      goldMonthKey: user?.loyaltyGoldMonthKey ?? null,
      giftMaxXof: ANTIGASPI_GIFT_MAX_XOF,
      voucherValidityDays: VOUCHER_VALIDITY_DAYS,
      tiers: LOYALTY_TIERS.map((t) => ({
        ...t,
        unlocked: count >= t.minCompleted,
      })),
      rewards,
      availableVouchers: available.filter(
        (r) => r.type === LoyaltyRewardType.voucher && (!r.expiresAt || r.expiresAt >= now),
      ),
      availableGifts: available.filter(
        (r) => r.type === LoyaltyRewardType.antigaspi_gift && (!r.expiresAt || r.expiresAt >= now),
      ),
    };
  }

  private assertUsable(reward: {
    status: LoyaltyRewardStatus;
    expiresAt: Date | null;
  }) {
    if (reward.status === LoyaltyRewardStatus.used) {
      throw new BadRequestException('Cette récompense a déjà été utilisée');
    }
    if (reward.status === LoyaltyRewardStatus.expired || (reward.expiresAt && reward.expiresAt < new Date())) {
      throw new BadRequestException('Cette récompense a expiré');
    }
    if (reward.status !== LoyaltyRewardStatus.available) {
      throw new BadRequestException('Récompense indisponible');
    }
  }
}
