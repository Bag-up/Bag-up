import { Injectable, ConflictException, NotFoundException, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../dto/register.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AdminCreateUserDto } from '../dto/admin-user.dto';
import { normalizePhoneE164 } from '../utils/phone.util';
import { ExternalNotificationsService } from '../notifications/external-notifications.service';
import { accountActivatedEmail } from '../notifications/email-templates';
import { NotificationsService } from '../notifications/notifications.service';
import { isDemarchesProvider } from '../missions/demarches';

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'provider':
      return 'prestataire';
    case 'merchant':
      return 'commerçant';
    case 'admin':
      return 'administrateur';
    case 'assistant':
      return 'assistante';
    case 'manager':
      return 'gérant';
    default:
      return 'client';
  }
}

export function roleAlreadyExistsMessage(role: UserRole): string {
  return `Un compte ${roleLabel(role)} existe déjà pour ce numéro`;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly externalNotifs: ExternalNotificationsService,
    private readonly notifications: NotificationsService,
  ) {}

  phoneVariantsWhere(phone: string) {
    const normalized = normalizePhoneE164(phone);
    return {
      OR: [
        { phone },
        { phone: normalized },
        { phone: normalized.replace(/^\+/, '') },
      ],
    };
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findFirst({
      where: this.phoneVariantsWhere(phone),
    });
  }

  async findAllByPhone(phone: string) {
    return this.prisma.user.findMany({
      where: this.phoneVariantsWhere(phone),
    });
  }

  async findByPhoneAndRole(phone: string, role: UserRole) {
    return this.prisma.user.findFirst({
      where: { AND: [this.phoneVariantsWhere(phone), { role }] },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { vehicle: true },
    });
  }

  /**
   * Si l'abonnement est encore marqué "active" mais que la date est dépassée,
   * on le passe immédiatement en "expired" (sans attendre le cron quotidien).
   */
  async syncSubscriptionExpiry<T extends {
    id: string;
    subscriptionStatus?: string | null;
    subscriptionExpiry?: Date | string | null;
  }>(user: T): Promise<T> {
    if (
      user.subscriptionStatus === 'active' &&
      user.subscriptionExpiry &&
      new Date(user.subscriptionExpiry) <= new Date()
    ) {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'expired' },
      });
      return { ...user, ...updated };
    }
    return user;
  }

  async create(dto: RegisterDto) {
    const normalizedPhone = normalizePhoneE164(dto.phone);
    const hashed = await bcrypt.hash(dto.password, 10);
    const referralCode = `BAG${normalizedPhone.replace(/^\+/, '').slice(-6)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    let user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: normalizedPhone,
        email: dto.email?.trim() ? dto.email.trim().toLowerCase() : null,
        password: hashed,
        role: dto.role,
        address: dto.address,
        country: dto.country,
        vehicleType: dto.vehicleType,
        idCardUrl: dto.idCardUrl,
        idCardBackUrl: dto.idCardBackUrl,
        licenseUrl: dto.licenseUrl,
        avatarUrl: dto.avatarUrl,
        zone: dto.zone,
        serviceCategories: dto.serviceCategories,
        demarchesServiceFee: dto.demarchesServiceFee,
        businessName: dto.businessName,
        businessAddress: dto.businessAddress,
        merchantChannels:
          dto.role === 'merchant'
            ? Array.from(
                new Set(
                  (dto.merchantChannels || []).filter((c) =>
                    c === 'antigaspi' || c === 'marketplace',
                  ),
                ),
              )
            : [],
        referralCode,
        referredBy: dto.referredBy,
      },
    });

    const siblings = await this.findAllByPhone(normalizedPhone);
    if (siblings.some((s) => s.id !== user.id && s.phoneVerified)) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      });
    }

    if (dto.role === 'provider' && dto.vehicleType) {
      await this.prisma.providerVehicle.create({
        data: {
          userId: user.id,
          type: dto.vehicleType,
          plate: dto.vehiclePlate?.trim() || null,
          brand: dto.vehicleBrand?.trim() || null,
          model: dto.vehicleModel?.trim() || null,
          color: dto.vehicleColor?.trim() || null,
          photoUrl: dto.vehiclePhotoUrl || null,
        },
      });
    }

    // Create a referral link if the user signed up with a valid referrer code
    if (dto.referredBy) {
      try {
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode: dto.referredBy },
        });
        if (referrer && referrer.id !== user.id) {
          // Anti-fraude (CDC §16): détecter une pièce d'identité déjà utilisée
          // par un autre compte, ou un même appareil/IP déjà parrainé par ce parrain.
          const fraudFlag = await this.detectReferralFraud(referrer.id, user.id, dto);
          await this.prisma.referral.create({
            data: {
              referrerId: referrer.id,
              referredId: user.id,
              // code is @unique per referral, so make it unique per referred user
              code: `${dto.referredBy}-${user.id.slice(0, 8)}`,
              rewardType: 'signup',
              rewardStatus: 'pending',
              fraudFlag,
              deviceId: dto.deviceId,
              ipAddress: dto.ipAddress,
            },
          });
        }
      } catch {
        // Ne pas bloquer l'inscription si la création du parrainage échoue
      }
    }

    return user;
  }

  /**
   * Détecte un parrainage potentiellement frauduleux (CDC §16):
   * - même pièce d'identité qu'un autre compte existant
   * - même appareil (deviceId) déjà parrainé par ce parrain
   * - même IP déjà parrainée par ce parrain
   */
  private async detectReferralFraud(
    referrerId: string,
    referredId: string,
    dto: RegisterDto,
  ): Promise<boolean> {
    // Pièce d'identité dupliquée
    if (dto.idCardUrl) {
      const dup = await this.prisma.user.findFirst({
        where: { idCardUrl: dto.idCardUrl, id: { not: referredId } },
        select: { id: true },
      });
      if (dup) return true;
    }
    // Même appareil / IP déjà parrainé par ce même parrain
    if (dto.deviceId || dto.ipAddress) {
      const existing = await this.prisma.referral.findFirst({
        where: {
          referrerId,
          OR: [
            ...(dto.deviceId ? [{ deviceId: dto.deviceId }] : []),
            ...(dto.ipAddress ? [{ ipAddress: dto.ipAddress }] : []),
          ],
        },
        select: { id: true },
      });
      if (existing) return true;
    }
    return false;
  }

  async update(id: string, dto: UpdateProfileDto) {
    const {
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      vehiclePhotoUrl,
      vehicleType,
      phone,
      email,
      ...userFields
    } = dto;

    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Utilisateur introuvable');

    const data: Record<string, unknown> = { ...userFields };
    if (vehicleType !== undefined) data.vehicleType = vehicleType;

    if (email !== undefined) {
      const nextEmail = email.trim() ? email.trim().toLowerCase() : null;
      if (nextEmail) {
        const emailTaken = await this.prisma.user.findFirst({
          where: {
            email: { equals: nextEmail, mode: 'insensitive' },
            role: current.role,
            NOT: { id },
          },
        });
        if (emailTaken) {
          throw new ConflictException('Cet email est déjà utilisé pour ce type de compte');
        }
      }
      data.email = nextEmail;
    }

    if (phone !== undefined) {
      const nextPhone = normalizePhoneE164(phone.trim());
      if (!nextPhone) throw new BadRequestException('Numéro de téléphone invalide');
      const phoneTaken = await this.prisma.user.findFirst({
        where: { phone: nextPhone, role: current.role, NOT: { id } },
      });
      if (phoneTaken) {
        throw new ConflictException(roleAlreadyExistsMessage(current.role));
      }
      data.phone = nextPhone;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        idCardUrl: true,
        idCardBackUrl: true,
        licenseUrl: true,
        isVerified: true,
        vehicleType: true,
        zone: true,
        serviceCategories: true,
        demarchesServiceFee: true,
        country: true,
        address: true,
        businessName: true,
        businessAddress: true,
        merchantChannels: true,
        referralCode: true,
        referredBy: true,
        credit: true,
        isAvailable: true,
        rating: true,
        totalRatings: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
        createdAt: true,
      },
    });

    const hasVehiclePatch =
      vehicleType !== undefined ||
      vehiclePlate !== undefined ||
      vehicleBrand !== undefined ||
      vehicleModel !== undefined ||
      vehicleColor !== undefined ||
      vehiclePhotoUrl !== undefined;

    if (hasVehiclePatch && (user.role === 'provider' || vehicleType)) {
      const type = vehicleType || user.vehicleType || 'moto';
      await this.prisma.providerVehicle.upsert({
        where: { userId: id },
        create: {
          userId: id,
          type,
          plate: vehiclePlate?.trim() || null,
          brand: vehicleBrand?.trim() || null,
          model: vehicleModel?.trim() || null,
          color: vehicleColor?.trim() || null,
          photoUrl: vehiclePhotoUrl || null,
        },
        update: {
          ...(vehicleType !== undefined ? { type: vehicleType } : {}),
          ...(vehiclePlate !== undefined ? { plate: vehiclePlate.trim() || null } : {}),
          ...(vehicleBrand !== undefined ? { brand: vehicleBrand.trim() || null } : {}),
          ...(vehicleModel !== undefined ? { model: vehicleModel.trim() || null } : {}),
          ...(vehicleColor !== undefined ? { color: vehicleColor.trim() || null } : {}),
          ...(vehiclePhotoUrl !== undefined ? { photoUrl: vehiclePhotoUrl || null } : {}),
        },
      });
    }

    const vehicle = await this.prisma.providerVehicle.findUnique({ where: { userId: id } });
    return { ...user, vehicle };
  }

  async setAvailability(id: string, isAvailable: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isAvailable },
      select: { id: true, isAvailable: true },
    });
  }

  async verifyProvider(id: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isVerified: true,
        role: true,
        phone: true,
        email: true,
        firstName: true,
        subscriptionStatus: true,
        kycRejectedAt: true,
      },
    });
    if (!existing) throw new NotFoundException('Utilisateur introuvable');
    if (existing.role !== 'provider' && existing.role !== 'merchant') {
      throw new BadRequestException('Seuls les prestataires et commerçants peuvent être validés');
    }

    const user = existing.isVerified
      ? existing
      : await this.prisma.user.update({
          where: { id },
          data: {
            isVerified: true,
            kycRejectedAt: null,
            kycRejectReason: null,
            subscriptionRefundPending: false,
            // Si suspendu uniquement après un refus KYC, on ne réactive pas sans paiement.
            // Le statut active reste s'ils ont déjà payé avant validation.
          },
          select: {
            id: true,
            isVerified: true,
            role: true,
            phone: true,
            email: true,
            firstName: true,
          },
        });

    if (!existing.isVerified) {
      void this.notifyAccountActivated(user).catch((err) =>
        this.logger.warn(`Activation notice failed: ${err?.message || err}`),
      );
    }

    return {
      id: user.id,
      isVerified: true as const,
      role: user.role,
      phone: user.phone,
      firstName: user.firstName,
    };
  }

  /**
   * Refus KYC après (ou avant) paiement.
   * Si un abonnement a déjà été payé → compte suspendu + flag remboursement à traiter.
   */
  async rejectVerification(id: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          where: { status: 'success' },
          select: { id: true, type: true, amount: true },
          take: 5,
        },
      },
    });
    if (!existing) throw new NotFoundException('Utilisateur introuvable');
    if (existing.role !== 'provider' && existing.role !== 'merchant') {
      throw new BadRequestException('Seuls les prestataires et commerçants peuvent être refusés');
    }
    if (existing.isVerified) {
      throw new BadRequestException('Compte déjà validé — désactivez-le plutôt que de refuser la KYC');
    }

    const paid = existing.subscriptions.length > 0;
    const rejectReason = (reason || '').trim().slice(0, 500) || null;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isVerified: false,
        kycRejectedAt: new Date(),
        kycRejectReason: rejectReason,
        subscriptionRefundPending: paid,
        ...(paid
          ? { subscriptionStatus: SubscriptionStatus.suspended }
          : {}),
      },
      select: {
        id: true,
        role: true,
        phone: true,
        email: true,
        firstName: true,
        kycRejectedAt: true,
        kycRejectReason: true,
        subscriptionRefundPending: true,
        subscriptionStatus: true,
      },
    });

    void this.notifyAccountRejected(user, paid).catch((err) =>
      this.logger.warn(`Rejection notice failed: ${err?.message || err}`),
    );

    return user;
  }

  async markSubscriptionRefunded(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Utilisateur introuvable');
    return this.prisma.user.update({
      where: { id },
      data: { subscriptionRefundPending: false },
      select: {
        id: true,
        subscriptionRefundPending: true,
        kycRejectedAt: true,
      },
    });
  }

  private async notifyAccountRejected(
    user: {
      id: string;
      role: UserRole;
      phone: string;
      email: string | null;
      firstName: string | null;
    },
    paid: boolean,
  ) {
    const roleFr = user.role === 'merchant' ? 'commerçant' : 'prestataire';
    const body = paid
      ? `Bag'up — Votre dossier ${roleFr} n'a pas été validé. Si vous avez payé, un remboursement sera traité sous 48–72 h. Contactez le support si besoin.`
      : `Bag'up — Votre dossier ${roleFr} n'a pas été validé. Vous pouvez corriger vos documents et nous recontacter.`;

    if (user.email?.trim()) {
      await this.externalNotifs.sendEmail(
        user.email.trim(),
        `Bag'up — Dossier non validé`,
        `<p>Bonjour ${user.firstName || ''},</p><p>${body}</p>`,
      );
    }
    await this.externalNotifs.sendSms(normalizePhoneE164(user.phone), body);
    await this.notifications.sendToUser(user.id, {
      title: 'Dossier non validé',
      body,
      data: { type: 'account_rejected' },
    });
  }

  private async notifyAccountActivated(user: {
    id: string;
    role: UserRole;
    phone: string;
    email: string | null;
    firstName: string | null;
  }) {
    const role = user.role === 'merchant' ? 'merchant' : 'provider';
    const roleFr = role === 'merchant' ? 'commerçant' : 'prestataire';

    if (user.email?.trim()) {
      const mail = accountActivatedEmail({ firstName: user.firstName, role });
      await this.externalNotifs.sendEmail(user.email.trim(), mail.subject, mail.html);
    }

    await this.externalNotifs.sendSms(
      normalizePhoneE164(user.phone),
      `Bag'up — Votre compte ${roleFr} est maintenant actif. Connectez-vous à l'application pour commencer.`,
    );

    await this.notifications.sendToUser(user.id, {
      title: 'Compte activé',
      body: `Votre compte ${roleFr} Bag'up est maintenant actif.`,
      data: { type: 'account_activated' },
    });
  }

  async findByRole(role: 'client' | 'provider' | 'merchant' | 'admin', zone?: string) {
    const where: any = { role };
    if (zone) {
      where.OR = [
        { zone: { contains: zone, mode: 'insensitive' } },
        { address: { contains: zone, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        rating: true,
        totalRatings: true,
        subscriptionStatus: true,
        zone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDemarchesProviders(zone?: string) {
    const providers = await this.prisma.user.findMany({
      where: {
        role: 'provider',
        isVerified: true,
        isActive: true,
        subscriptionStatus: 'active',
        serviceCategories: { contains: 'demarches_admin' },
        demarchesServiceFee: { not: null },
        ...(zone ? { zone } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        zone: true,
        rating: true,
        totalRatings: true,
        avatarUrl: true,
        demarchesServiceFee: true,
        vehicleType: true,
        serviceCategories: true,
      },
      orderBy: { demarchesServiceFee: 'asc' },
    });
    return providers.filter(
      (p) => isDemarchesProvider(p) && (p.demarchesServiceFee || 0) >= 1000,
    );
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
        avatarUrl: true,
        idCardUrl: true,
        idCardBackUrl: true,
        licenseUrl: true,
        vehicleType: true,
        zone: true,
        serviceCategories: true,
        country: true,
        address: true,
        businessName: true,
        businessAddress: true,
        merchantChannels: true,
        referralCode: true,
        referredBy: true,
        rating: true,
        totalRatings: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Création d'un compte depuis le panel admin (multi-rôles, déjà vérifié). */
  async createByAdmin(dto: AdminCreateUserDto) {
    const normalizedPhone = normalizePhoneE164(dto.phone);
    const existingPhone = await this.findByPhoneAndRole(normalizedPhone, dto.role);
    if (existingPhone) {
      throw new ConflictException(roleAlreadyExistsMessage(dto.role));
    }
    if (dto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: dto.email, role: dto.role },
      });
      if (existingEmail) {
        throw new ConflictException('Cet email est déjà utilisé pour ce type de compte');
      }
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const referralCode = `BAG${normalizedPhone.replace(/^\+/, '').slice(-6)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: normalizedPhone,
        email: dto.email || null,
        password: hashed,
        role: dto.role,
        referralCode,
        isActive: true,
        // Comptes créés par admin : déjà vérifiés (pas de frein OTP / validation)
        phoneVerified: true,
        isVerified: true,
      },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
        phoneVerified: true,
        createdAt: true,
      },
    });
    return user;
  }

  async changeMyPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect');
    if (currentPassword === newPassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return { message: 'Mot de passe mis à jour' };
  }

  async resetPasswordByAdmin(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== 'admin') {
      throw new BadRequestException(
        'La réinitialisation admin est réservée aux comptes administrateur. Les autres utilisateurs doivent utiliser « mot de passe oublié ».',
      );
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, resetToken: null, resetExpiry: null },
    });
    return { message: 'Mot de passe réinitialisé' };
  }

  async updateFcmToken(id: string, fcmToken: string) {
    return this.prisma.user.update({
      where: { id },
      data: { fcmToken },
      select: { id: true, fcmToken: true },
    });
  }

  async getMyReferrals(userId: string) {
    return this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllReferrals() {
    return this.prisma.referral.findMany({
      include: {
        referrer: { select: { id: true, firstName: true, lastName: true, phone: true, referralCode: true } },
        referred: { select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getZoneStats() {
    const providers = await this.prisma.user.findMany({
      where: { role: 'provider' },
      select: { zone: true, isVerified: true, subscriptionStatus: true },
    });
    const zoneMap: Record<string, { total: number; verified: number; active: number }> = {};
    providers.forEach((p) => {
      const zone = p.zone || 'Non spécifié';
      if (!zoneMap[zone]) zoneMap[zone] = { total: 0, verified: 0, active: 0 };
      zoneMap[zone].total++;
      if (p.isVerified) zoneMap[zone].verified++;
      if (p.subscriptionStatus === 'active') zoneMap[zone].active++;
    });
    return Object.entries(zoneMap).map(([zone, stats]) => ({ zone, ...stats }));
  }

  /** Suppression définitive du compte (exigence App Store 5.1.1). */
  async deleteMyAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role === 'admin' || user.role === 'assistant' || user.role === 'manager') {
      throw new BadRequestException('Les comptes staff ne peuvent pas être supprimés depuis l\'application.');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Mot de passe incorrect');

    const activeMission = await this.prisma.mission.count({
      where: {
        OR: [{ clientId: userId }, { providerId: userId }],
        status: {
          notIn: [
            'delivered',
            'cancelled',
            'returned_to_client',
            'document_collected',
            'document_ready',
          ],
        },
      },
    });
    if (activeMission > 0) {
      throw new BadRequestException(
        'Impossible de supprimer le compte tant qu\'une mission est en cours. Terminez-la ou annulez-la d\'abord.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const shops = await tx.shop.findMany({ where: { ownerId: userId }, select: { id: true } });
      for (const shop of shops) {
        const orders = await tx.marketplaceOrder.findMany({ where: { shopId: shop.id }, select: { id: true } });
        for (const order of orders) {
          await tx.marketplaceOrderItem.deleteMany({ where: { orderId: order.id } });
        }
        await tx.marketplaceOrder.deleteMany({ where: { shopId: shop.id } });
        await tx.product.deleteMany({ where: { shopId: shop.id } });
      }
      await tx.shop.deleteMany({ where: { ownerId: userId } });

      const buyerOrders = await tx.marketplaceOrder.findMany({ where: { buyerId: userId }, select: { id: true } });
      for (const order of buyerOrders) {
        await tx.marketplaceOrderItem.deleteMany({ where: { orderId: order.id } });
      }
      await tx.marketplaceOrder.deleteMany({ where: { buyerId: userId } });

      const baskets = await tx.antiGaspiBasket.findMany({ where: { merchantId: userId }, select: { id: true } });
      for (const basket of baskets) {
        const reservations = await tx.antiGaspiReservation.findMany({
          where: { basketId: basket.id },
          select: { id: true },
        });
        for (const reservation of reservations) {
          await tx.antiGaspiTransaction.deleteMany({ where: { reservationId: reservation.id } });
        }
        await tx.antiGaspiReservation.deleteMany({ where: { basketId: basket.id } });
      }
      await tx.antiGaspiBasket.deleteMany({ where: { merchantId: userId } });

      const clientReservations = await tx.antiGaspiReservation.findMany({
        where: { clientId: userId },
        select: { id: true },
      });
      for (const reservation of clientReservations) {
        await tx.antiGaspiTransaction.deleteMany({ where: { reservationId: reservation.id } });
      }
      await tx.antiGaspiReservation.deleteMany({ where: { clientId: userId } });

      const clientMissionIds = (
        await tx.mission.findMany({ where: { clientId: userId }, select: { id: true } })
      ).map((m) => m.id);

      for (const missionId of clientMissionIds) {
        const conversation = await tx.conversation.findFirst({ where: { missionId } });
        if (conversation) {
          await tx.message.deleteMany({ where: { conversationId: conversation.id } });
          await tx.conversation.delete({ where: { id: conversation.id } });
        }
        await tx.dispute.deleteMany({ where: { missionId } });
        await tx.rating.deleteMany({ where: { missionId } });
        await tx.payment.deleteMany({ where: { missionId } });
        await tx.marketplaceOrder.updateMany({ where: { missionId }, data: { missionId: null } });
      }
      await tx.mission.deleteMany({ where: { clientId: userId } });
      await tx.mission.updateMany({ where: { providerId: userId }, data: { providerId: null } });

      const conversations = await tx.conversation.findMany({
        where: { OR: [{ clientId: userId }, { providerId: userId }] },
        select: { id: true },
      });
      for (const conversation of conversations) {
        await tx.message.deleteMany({ where: { conversationId: conversation.id } });
      }
      await tx.conversation.deleteMany({
        where: { OR: [{ clientId: userId }, { providerId: userId }] },
      });

      await tx.message.deleteMany({ where: { senderId: userId } });
      await tx.rating.deleteMany({ where: { OR: [{ raterId: userId }, { ratedId: userId }] } });
      await tx.payment.deleteMany({ where: { userId } });
      await tx.subscription.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.dispute.deleteMany({ where: { raisedById: userId } });
      await tx.referral.deleteMany({
        where: { OR: [{ referrerId: userId }, { referredId: userId }] },
      });
      await tx.providerVehicle.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { message: 'Compte supprimé définitivement' };
  }
}
