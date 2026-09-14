import { forwardRef, Inject, Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MissionStatus, MissionPayoutStatus, Prisma } from '@prisma/client';
import { CreateMissionDto } from '../dto/create-mission.dto';
import { GeoService } from '../geo/geo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExternalNotificationsService } from '../notifications/external-notifications.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  missionAcceptedEmail,
  missionCreatedEmail,
  missionDeliveredEmail,
} from '../notifications/email-templates';
import {
  normalizeVehicleMode,
  requiresVehicleMode,
  vehicleModeLabel,
} from './vehicle-mode';
import {
  isDemarchesMission,
  isDemarchesProvider,
  providerNetFromServiceFee,
} from './demarches';

const NOTIFICATION_RADIUS_KM = 10;
const MAX_NOTIFICATION_PROVIDERS = 20;
/** 0 % commission au lancement (aligné copy app). */
const PROVIDER_COMMISSION_RATE = 0;
/** Délai avant éligibilité au reversement (comme marketplace). */
const PAYOUT_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

const providerWithVehicle = {
  include: { vehicle: true },
} as const;

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly notifications: NotificationsService,
    private readonly externalNotifs: ExternalNotificationsService,
    @Inject(forwardRef(() => MarketplaceService))
    private readonly marketplace: MarketplaceService,
    private readonly loyalty: LoyaltyService,
  ) {}

  async create(dto: CreateMissionDto, clientId: string) {
    const details =
      dto.serviceDetails && typeof dto.serviceDetails === 'object'
        ? (dto.serviceDetails as Record<string, unknown>)
        : {};
    const estimatedValueCandidates = [
      details.sharedEstimatedValue,
      details.estimatedValue,
    ];
    const estimatedValue = estimatedValueCandidates
      .map((value) => Number(String(value ?? '').replace(/[^\d]/g, '')))
      .find((value) => Number.isFinite(value) && value > 0) ?? 0;
    const requiresSecureDeliveryCode =
      ['colis', 'objets_personnels'].includes(dto.serviceType) &&
      estimatedValue > 50000;

    const deliveryCode = (dto.recipientName || requiresSecureDeliveryCode)
      ? Math.random().toString(36).slice(2, 8).toUpperCase()
      : undefined;

    // Auto-detect valuable shipments requiring ID verification
    const valuableServices = ['documents', 'depot_administratif'];
    const requiresIdVerification = dto.requiresIdVerification
      ?? (dto.recipientName ? true : valuableServices.includes(dto.serviceType) || requiresSecureDeliveryCode);

    let vehicleMode = normalizeVehicleMode(dto.vehicleMode)
      ?? normalizeVehicleMode(typeof details.vehicleNeeded === 'string' ? details.vehicleNeeded : null);

    if (requiresVehicleMode(dto.serviceType)) {
      if (!vehicleMode) {
        throw new BadRequestException('Choisissez moto ou voiture pour cette livraison');
      }
    } else {
      vehicleMode = null;
    }

    let price = dto.price;

    if (isDemarchesMission(dto.serviceType)) {
      const preferredProviderId =
        typeof details.preferredProviderId === 'string' ? details.preferredProviderId : '';
      if (!preferredProviderId) {
        throw new BadRequestException('Choisissez un prestataire démarches');
      }
      const chosen = await this.prisma.user.findUnique({
        where: { id: preferredProviderId },
        select: {
          id: true,
          role: true,
          isVerified: true,
          isActive: true,
          subscriptionStatus: true,
          subscriptionExpiry: true,
          serviceCategories: true,
          vehicleType: true,
          demarchesServiceFee: true,
        },
      });
      const subOk =
        chosen?.subscriptionStatus === 'active' &&
        (!chosen.subscriptionExpiry || new Date(chosen.subscriptionExpiry) > new Date());
      if (!chosen || !isDemarchesProvider(chosen) || !chosen.isVerified || !chosen.isActive || !subOk) {
        throw new BadRequestException('Ce prestataire démarches n’est pas disponible');
      }
      const serviceFee = chosen.demarchesServiceFee;
      if (!serviceFee || serviceFee < 1000) {
        throw new BadRequestException('Ce prestataire n’a pas encore fixé ses honoraires');
      }
      const officialFee = Math.max(0, Math.round(dto.adminFeeEstimated || 0));
      details.preferredProviderId = chosen.id;
      details.serviceFee = serviceFee;
      price = serviceFee + officialFee;
    }

    const mission = await this.prisma.mission.create({
      data: {
        serviceType: dto.serviceType,
        urgency: dto.urgency,
        pickupAddress: dto.pickupAddress,
        deliveryAddress: dto.deliveryAddress,
        description: dto.description,
        price,
        vehicleMode,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        photos: dto.photos,
        adminProcedureType: dto.adminProcedureType,
        adminOrganism: dto.adminOrganism,
        adminFeeEstimated: dto.adminFeeEstimated,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        recipientRelation: dto.recipientRelation,
        recipientAddress: dto.recipientAddress,
        clientCountry: dto.clientCountry,
        deliveryCode,
        requiresIdVerification,
        serviceDetails: Object.keys(details).length
          ? (details as Prisma.InputJsonValue)
          : undefined,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        clientId,
      },
      include: { client: true, provider: providerWithVehicle },
    });

    // Notify nearby providers via push
    this.notifyNearbyProviders(mission).catch((err) =>
      this.logger.error('Failed to notify providers:', err),
    );

    // Accusé de réception création (email)
    if (mission.client?.email) {
      const mail = missionCreatedEmail({
        firstName: mission.client.firstName,
        serviceType: mission.serviceType,
        pickupAddress: mission.pickupAddress,
        deliveryAddress: mission.deliveryAddress,
        price: mission.price != null ? Number(mission.price) : null,
        missionId: mission.id,
      });
      this.externalNotifs
        .sendEmail(mission.client.email, mail.subject, mail.html)
        .catch((err) => this.logger.error('Failed to send missionCreated email:', err));
    }

    // Send delivery code to client via SMS if remise à tiers
    if (deliveryCode && mission.client?.phone) {
      const codeMsg = `Bag'up - Votre code de remise pour la mission est: ${deliveryCode}. Communiquez-le au destinataire qui devra le presenter au prestataire.`;
      this.externalNotifs.sendSms(mission.client.phone, codeMsg).catch((err) =>
        this.logger.error('Failed to send delivery code SMS:', err),
      );
      this.externalNotifs.sendWhatsApp(mission.client.phone, `🔐 *Bag'up - Code de remise*

Votre code de remise: *${deliveryCode}*

Communiquez-le au destinataire (tiers/GP) qui devra le présenter au prestataire avant la remise.`).catch(() => {});
    }

    return mission;
  }

  private eligibleProviderWhere(vehicleMode?: string | null) {
    const mode = normalizeVehicleMode(vehicleMode);
    return {
      role: 'provider' as const,
      isActive: true,
      isVerified: true,
      isAvailable: true,
      subscriptionStatus: 'active' as const,
      AND: [
        {
          OR: [
            { subscriptionExpiry: null },
            { subscriptionExpiry: { gt: new Date() } },
          ],
        },
        ...(mode
          ? [
              {
                OR: [
                  { vehicleType: mode },
                  { vehicle: { is: { type: mode } } },
                ],
              },
            ]
          : []),
        {
          NOT: {
            AND: [
              { serviceCategories: { contains: 'demarches_admin' } },
              { OR: [{ vehicleType: null }, { vehicleType: '' }] },
            ],
          },
        },
      ],
    };
  }

  private async notifyNearbyProviders(mission: any) {
    if (isDemarchesMission(mission.serviceType)) {
      const details = (mission.serviceDetails || {}) as Record<string, unknown>;
      const preferred =
        typeof details.preferredProviderId === 'string' ? details.preferredProviderId : '';
      if (!preferred) return;
      await this.notifications.sendToUsers([preferred], {
        title: 'Nouvelle démarche',
        body: `${mission.adminProcedureType || 'Dossier'} — ${mission.pickupAddress}`,
        data: { missionId: mission.id, type: 'new_mission', serviceType: mission.serviceType },
      });
      return;
    }

    const modeLabel = vehicleModeLabel(mission.vehicleMode);
    const title = modeLabel
      ? `Nouvelle course ${modeLabel}`
      : 'Nouvelle mission disponible';
    const providerWhere = this.eligibleProviderWhere(mission.vehicleMode);

    if (!mission.pickupLat || !mission.pickupLng) {
      // Fallback: notify all active providers in the same zone
      const providers = await this.prisma.user.findMany({
        where: providerWhere,
        select: { id: true, zone: true, fcmToken: true },
      });
      const filtered = mission.pickupAddress
        ? providers.filter((p) =>
            p.zone?.toLowerCase().includes(mission.pickupAddress.toLowerCase().split(',')[0].toLowerCase()) ||
            mission.pickupAddress.toLowerCase().includes(p.zone?.toLowerCase() || ''),
          )
        : providers;
      const targetIds = (filtered.length > 0 ? filtered : providers)
        .slice(0, MAX_NOTIFICATION_PROVIDERS)
        .map((p) => p.id);
      if (targetIds.length > 0) {
        await this.notifications.sendToUsers(targetIds, {
          title,
          body: `${mission.serviceType} - ${mission.pickupAddress} → ${mission.deliveryAddress}`,
          data: { missionId: mission.id, type: 'new_mission', vehicleMode: mission.vehicleMode || '' },
        });
      }
      return;
    }

    const pickupLat = parseFloat(mission.pickupLat);
    const pickupLng = parseFloat(mission.pickupLng);
    const mode = normalizeVehicleMode(mission.vehicleMode);

    // Find providers with recent location data (active missions with providerLat/Lng)
    const providersWithLocation = await this.prisma.mission.findMany({
      where: {
        providerLat: { not: null },
        providerLng: { not: null },
        status: { in: [MissionStatus.accepted, MissionStatus.en_route, MissionStatus.picked_up, MissionStatus.in_progress] },
        ...(mode
          ? {
              provider: {
                is: {
                  OR: [
                    { vehicleType: mode },
                    { vehicle: { is: { type: mode } } },
                  ],
                },
              },
            }
          : {}),
      },
      select: { providerId: true, providerLat: true, providerLng: true },
      distinct: ['providerId'],
    });

    const nearbyProviderIds: string[] = [];
    for (const p of providersWithLocation) {
      if (!p.providerId || !p.providerLat || !p.providerLng) continue;
      const dist = this.geo.haversineDistance(
        { lat: pickupLat, lng: pickupLng },
        { lat: parseFloat(p.providerLat), lng: parseFloat(p.providerLng) },
      );
      if (dist <= NOTIFICATION_RADIUS_KM) {
        nearbyProviderIds.push(p.providerId);
      }
    }

    // Also include verified providers without active missions (they might be idle nearby)
    const idleProviders = await this.prisma.user.findMany({
      where: providerWhere,
      select: { id: true, zone: true, phone: true },
    });

    // If we have GPS coords, also add idle providers whose zone matches pickup area
    const pickupZone = mission.pickupAddress?.split(',').pop()?.trim()?.toLowerCase() || '';
    const zoneMatchIds = idleProviders
      .filter((p) => p.zone?.toLowerCase().includes(pickupZone) || pickupZone.includes(p.zone?.toLowerCase() || ''))
      .map((p) => p.id)
      .filter((id) => !nearbyProviderIds.includes(id));

    const allTargetIds = [...nearbyProviderIds, ...zoneMatchIds].slice(0, MAX_NOTIFICATION_PROVIDERS);

    // If no nearby providers found, notify all verified providers as fallback (still vehicle-filtered)
    const finalTargetIds = allTargetIds.length > 0
      ? allTargetIds
      : idleProviders.map((p) => p.id).slice(0, MAX_NOTIFICATION_PROVIDERS);

    if (finalTargetIds.length > 0) {
      await this.notifications.sendToUsers(finalTargetIds, {
        title,
        body: `${mission.serviceType} - Retrait: ${mission.pickupAddress}`,
        data: { missionId: mission.id, type: 'new_mission', vehicleMode: mission.vehicleMode || '' },
      });

      // Push only for nearby providers (SMS réservé à OTP / code remise / acceptée / livrée)
      this.logger.log(`Notified ${finalTargetIds.length} providers about mission ${mission.id}`);
    }
  }

  async findAll() {
    return this.prisma.mission.findMany({
      include: { client: true, provider: providerWithVehicle },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByClient(clientId: string) {
    return this.prisma.mission.findMany({
      where: { clientId },
      include: { provider: providerWithVehicle },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAvailable(
    zone?: string,
    lat?: number,
    lng?: number,
    radiusKm: number = 15,
    providerId?: string,
  ) {
    const where: any = { status: MissionStatus.pending };
    if (zone) {
      where.OR = [
        { pickupAddress: { contains: zone, mode: 'insensitive' } },
        { deliveryAddress: { contains: zone, mode: 'insensitive' } },
      ];
    }

    let providerVehicleType: string | null = null;
    let demarchesOnly = false;
    if (providerId) {
      const provider = await this.prisma.user.findUnique({
        where: { id: providerId },
        select: {
          vehicleType: true,
          serviceCategories: true,
          vehicle: { select: { type: true } },
        },
      });
      providerVehicleType = provider?.vehicle?.type || provider?.vehicleType || null;
      demarchesOnly = isDemarchesProvider(provider);
    }

    const missions = await this.prisma.mission.findMany({
      where,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });

    // Marketplace: visible seulement après « colis préparé » (dispatchReady)
    let dispatchable = missions.filter((m) => {
      const details = m.serviceDetails as Record<string, unknown> | null;
      if (details?.marketplaceOrderId && details?.dispatchReady !== true) return false;
      return true;
    });

    if (demarchesOnly) {
      dispatchable = dispatchable.filter((m) => {
        if (!isDemarchesMission(m.serviceType)) return false;
        const details = m.serviceDetails as Record<string, unknown> | null;
        return details?.preferredProviderId === providerId;
      });
    } else {
      dispatchable = dispatchable.filter((m) => !isDemarchesMission(m.serviceType));
    }

    // Strict vehicle match: missions with vehicleMode only visible to matching providers
    if (providerVehicleType) {
      dispatchable = dispatchable.filter((m) => {
        if (!m.vehicleMode) return true;
        return m.vehicleMode === providerVehicleType;
      });
    }

    // If we have provider GPS coords, filter by distance and sort by proximity
    if (lat !== undefined && lng !== undefined) {
      const withDistance = dispatchable
        .filter((m) => m.pickupLat && m.pickupLng)
        .map((m) => ({
          ...m,
          distanceKm: this.geo.haversineDistance(
            { lat, lng },
            { lat: parseFloat(m.pickupLat!), lng: parseFloat(m.pickupLng!) },
          ),
        }))
        .filter((m) => m.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      // Also include missions without GPS coords (text-only addresses) at the end
      const noGps = dispatchable.filter((m) => !m.pickupLat || !m.pickupLng);
      return [...withDistance, ...noGps];
    }

    return dispatchable;
  }

  /** Relance le dispatch prestataires (ex. après préparation marketplace). */
  async dispatchToProviders(missionId: string) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      include: { client: true },
    });
    if (!mission || mission.status !== MissionStatus.pending) return;
    await this.notifyNearbyProviders(mission);
  }

  async findByProvider(providerId: string) {
    return this.prisma.mission.findMany({
      where: { providerId },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.mission.findUnique({
      where: { id },
      include: { client: true, provider: providerWithVehicle, payments: true },
    });
  }

  private async assertProviderCanTakeMissions(providerId: string) {
    const provider = await this.prisma.user.findUnique({
      where: { id: providerId },
      select: {
        role: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
        isVerified: true,
        isActive: true,
        firstName: true,
        lastName: true,
        serviceCategories: true,
        demarchesServiceFee: true,
        vehicleType: true,
        vehicle: { select: { type: true, plate: true, brand: true, model: true, color: true } },
      },
    });
    if (!provider?.isActive || !provider.isVerified || provider.role !== 'provider') {
      throw new BadRequestException('Compte prestataire non autorisé');
    }
    const expiryOk =
      provider.subscriptionStatus === 'active' &&
      (!provider.subscriptionExpiry || new Date(provider.subscriptionExpiry) > new Date());
    if (!expiryOk) {
      if (provider.subscriptionStatus === 'active' && provider.subscriptionExpiry) {
        await this.prisma.user.update({
          where: { id: providerId },
          data: { subscriptionStatus: 'expired' },
        });
      }
      throw new BadRequestException('Abonnement prestataire expiré');
    }
    return provider;
  }

  async accept(id: string, providerId: string) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!mission) throw new Error('Mission introuvable');
    if (mission.status !== MissionStatus.pending) {
      throw new Error('Cette mission a déjà été acceptée par un autre prestataire');
    }

    const provider = await this.assertProviderCanTakeMissions(providerId);
    const demarchesMission = isDemarchesMission(mission.serviceType);
    const demarchesProfile = isDemarchesProvider(provider);
    if (demarchesMission !== demarchesProfile) {
      throw new BadRequestException(
        demarchesMission
          ? 'Cette démarche est réservée à un prestataire démarches'
          : 'Ce profil ne peut pas prendre de courses',
      );
    }
    if (demarchesMission) {
      const details = (mission.serviceDetails || {}) as Record<string, unknown>;
      if (details.preferredProviderId && details.preferredProviderId !== providerId) {
        throw new BadRequestException('Cette démarche est attribuée à un autre prestataire');
      }
    }
    const providerMode = provider.vehicle?.type || provider.vehicleType || null;
    const requiredMode = normalizeVehicleMode(mission.vehicleMode);
    if (requiredMode && providerMode !== requiredMode) {
      throw new BadRequestException(
        `Cette mission nécessite une ${vehicleModeLabel(requiredMode).toLowerCase()}`,
      );
    }

    // Vérifier que la mission est payée avant de permettre l'acceptation
    const isPaid = mission.payments?.some((p: any) => p.status === 'success');
    if (!isPaid) {
      throw new Error('Cette mission n\'a pas encore été payée par le client');
    }
    const updated = await this.prisma.mission.update({
      where: { id },
      data: { providerId, status: MissionStatus.accepted },
      include: { client: true, provider: providerWithVehicle },
    });

    this.marketplace.syncFromMission(id, MissionStatus.accepted).catch((err) =>
      this.logger.error('Marketplace sync (accept) failed:', err),
    );

    const plate = updated.provider?.vehicle?.plate;
    const vehicleHint = [
      vehicleModeLabel(updated.provider?.vehicle?.type || updated.provider?.vehicleType),
      plate,
    ]
      .filter(Boolean)
      .join(' · ');

    // Notify the client that their mission was accepted (push + WhatsApp + SMS)
    await this.notifications.sendToUser(mission.clientId, {
      title: 'Mission acceptée !',
      body: vehicleHint
        ? `${updated.provider?.firstName} arrive · ${vehicleHint}`
        : `${updated.provider?.firstName} ${updated.provider?.lastName} a accepté votre mission.`,
      data: { missionId: id, type: 'mission_accepted' },
    }).catch((err) => this.logger.error('Failed to notify client:', err));

    // Send WhatsApp + SMS to client
    const client = await this.prisma.user.findUnique({
      where: { id: mission.clientId },
      select: { phone: true, email: true, firstName: true },
    });
    if (client?.phone) {
      const waMsg = vehicleHint
        ? `✅ *Bag'Up - Mission acceptée*\n\n${updated.provider?.firstName} arrive en ${vehicleHint}.\n\nSuivez la livraison en direct dans l'app.`
        : `✅ *Bag'Up - Mission acceptée*\n\n${updated.provider?.firstName} ${updated.provider?.lastName} a accepté votre mission.\n\nSuivez la livraison en direct dans l'app.`;
      this.externalNotifs.sendWhatsApp(client.phone, waMsg).catch(() => {});
      this.externalNotifs.sendSms(
        client.phone,
        vehicleHint
          ? `Bag'Up: ${updated.provider?.firstName} accepte · ${vehicleHint}. Suivez dans l'app.`
          : `Bag'Up: Mission acceptee par ${updated.provider?.firstName}. Suivez la livraison dans l'app.`,
      ).catch(() => {});
    }
    if (client?.email) {
      const providerName = [updated.provider?.firstName, updated.provider?.lastName]
        .filter(Boolean)
        .join(' ') || 'Un prestataire';
      const mail = missionAcceptedEmail({
        firstName: client.firstName,
        providerName: vehicleHint ? `${providerName} (${vehicleHint})` : providerName,
        serviceType: updated.serviceType,
        pickupAddress: updated.pickupAddress,
      });
      this.externalNotifs
        .sendEmail(client.email, mail.subject, mail.html)
        .catch((err) => this.logger.error('Failed to send missionAccepted email:', err));
    }

    return updated;
  }

  /** Assignation forcée par l’admin (filet marketplace / litige). */
  async adminAssign(id: string, providerId: string) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!mission) throw new NotFoundException('Mission introuvable');
    if (mission.status !== MissionStatus.pending) {
      throw new BadRequestException('La mission n’est plus en attente d’un livreur');
    }
    if (mission.providerId) {
      throw new BadRequestException('Un livreur est déjà assigné');
    }

    const isPaid = mission.payments?.some((p: any) => p.status === 'success');
    if (!isPaid) {
      throw new BadRequestException('La mission n’est pas encore payée');
    }

    const provider = await this.assertProviderCanTakeMissions(providerId);

    const updated = await this.prisma.mission.update({
      where: { id },
      data: { providerId, status: MissionStatus.accepted },
      include: { client: true, provider: providerWithVehicle },
    });

    this.marketplace.syncFromMission(id, MissionStatus.accepted).catch((err) =>
      this.logger.error('Marketplace sync (adminAssign) failed:', err),
    );

    await this.notifications
      .sendToUser(providerId, {
        title: 'Mission assignée',
        body: `Bag'up vous a assigné une livraison. Ouvrez l’app pour démarrer.`,
        data: { missionId: id, type: 'new_mission' },
      })
      .catch((err) => this.logger.error('Failed to notify provider:', err));

    await this.notifications
      .sendToUser(mission.clientId, {
        title: 'Livreur assigné',
        body: `${provider.firstName} ${provider.lastName} prendra en charge votre livraison.`,
        data: { missionId: id, type: 'mission_accepted' },
      })
      .catch((err) => this.logger.error('Failed to notify client:', err));

    const client = await this.prisma.user.findUnique({
      where: { id: mission.clientId },
      select: { email: true, firstName: true, phone: true },
    });
    if (client?.email) {
      const providerName = [provider.firstName, provider.lastName].filter(Boolean).join(' ') || 'Un prestataire';
      const mail = missionAcceptedEmail({
        firstName: client.firstName,
        providerName,
        serviceType: updated.serviceType,
        pickupAddress: updated.pickupAddress,
      });
      this.externalNotifs
        .sendEmail(client.email, mail.subject, mail.html)
        .catch((err) => this.logger.error('Failed to send missionAccepted email (admin):', err));
    }
    if (client?.phone) {
      this.externalNotifs
        .sendSms(
          client.phone,
          `Bag'Up: Mission acceptee par ${provider.firstName}. Suivez la livraison dans l'app.`,
        )
        .catch(() => {});
    }

    return updated;
  }

  async updateStatus(id: string, status: MissionStatus, code?: string) {
    // Vérification du code de remise pour les missions avec remise à un tiers/GP
    const FINAL_REMISE_STATUSES: MissionStatus[] = [
      MissionStatus.delivered,
      MissionStatus.returned_to_client,
    ];
    if (FINAL_REMISE_STATUSES.includes(status)) {
      const mission = await this.prisma.mission.findUnique({
        where: { id },
        select: { deliveryCode: true },
      });
      if (mission?.deliveryCode) {
        if (!code) {
          throw new BadRequestException('Code de remise requis pour valider la remise');
        }
        if (code.trim() !== mission.deliveryCode) {
          throw new BadRequestException('Code de remise incorrect');
        }
      }
    }

    const updated = await this.prisma.mission.update({
      where: { id },
      data: { status },
      include: { client: true, provider: providerWithVehicle },
    });

    const payoutStatuses: MissionStatus[] = isDemarchesMission(updated.serviceType)
      ? [MissionStatus.delivered, MissionStatus.returned_to_client]
      : [MissionStatus.delivered];
    if (payoutStatuses.includes(status) && updated.providerId && !updated.providerAmount) {
      const details = (updated.serviceDetails || {}) as Record<string, unknown>;
      const serviceFee = Number(details.serviceFee || 0);
      const price = Number(updated.price);
      const providerAmount = isDemarchesMission(updated.serviceType) && serviceFee > 0
        ? providerNetFromServiceFee(serviceFee)
        : Math.round(price * (1 - PROVIDER_COMMISSION_RATE));
      await this.prisma.mission.update({
        where: { id },
        data: {
          providerAmount,
          payoutStatus: MissionPayoutStatus.held,
          payoutEligibleAt: new Date(Date.now() + PAYOUT_DELAY_MS),
        },
      });
      updated.providerAmount = providerAmount as any;
      updated.payoutStatus = MissionPayoutStatus.held;
    }

    this.marketplace.syncFromMission(id, status).catch((err) =>
      this.logger.error('Marketplace sync (status) failed:', err),
    );

    if (FINAL_REMISE_STATUSES.includes(status)) {
      this.loyalty.syncProgress(updated.clientId).catch((err) =>
        this.logger.error('Loyalty sync (mission) failed:', err),
      );
    }

    // Notify client on key status changes
    const statusMessages: Record<string, string> = {
      en_route: 'Le prestataire est en route vers le point de collecte',
      picked_up: 'Votre colis a été récupéré',
      in_progress: 'Livraison en cours',
      delivered: 'Votre colis a été livré',
      cancelled: 'Mission annulée',
      returned_to_client: 'Documents restitués',
      dossier_deposed: 'Dossier déposé auprès de l\'administration',
      admin_processing: 'Dossier en attente de traitement par l\'administration',
      document_ready: 'Document disponible et prêt à être retiré',
      document_collected: 'Document retiré par le prestataire',
    };
    if (statusMessages[status]) {
      await this.notifications.sendToUser(updated.clientId, {
        title: 'Mise à jour de mission',
        body: statusMessages[status],
        data: { missionId: id, type: 'status_update', status },
      }).catch((err) => this.logger.error('Failed to notify client:', err));

      // SMS + email uniquement à la livraison (coût SMS) — push pour les autres statuts
      if (status === MissionStatus.delivered) {
        const client = updated.client;
        if (client?.phone) {
          const waMsg = `📦 *Bag'Up*\n\n${statusMessages[status]}`;
          this.externalNotifs.sendWhatsApp(client.phone, waMsg).catch(() => {});
          this.externalNotifs
            .sendSms(client.phone, `Bag'Up: ${statusMessages[status]}`)
            .catch(() => {});
        }
        if (client?.email) {
          const providerName = [updated.provider?.firstName, updated.provider?.lastName]
            .filter(Boolean)
            .join(' ');
          const mail = missionDeliveredEmail({
            firstName: client.firstName,
            serviceType: updated.serviceType,
            deliveryAddress: updated.deliveryAddress,
            providerName: providerName || null,
          });
          this.externalNotifs
            .sendEmail(client.email, mail.subject, mail.html)
            .catch((err) => this.logger.error('Failed to send missionDelivered email:', err));
        }
      }
    }

    return updated;
  }

  async refuse(id: string) {
    return this.prisma.mission.update({
      where: { id },
      data: { status: MissionStatus.pending, providerId: null },
      include: { client: true, provider: providerWithVehicle },
    });
  }

  async cancel(id: string, userId: string) {
    const mission = await this.prisma.mission.findUnique({ where: { id } });
    if (!mission) throw new Error('Mission introuvable');
    if (mission.clientId !== userId && mission.providerId !== userId) {
      throw new Error('Non autorisé');
    }
    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.cancelled,
        ...(mission.payoutStatus === MissionPayoutStatus.held ||
        mission.payoutStatus === MissionPayoutStatus.eligible
          ? { payoutStatus: MissionPayoutStatus.cancelled }
          : {}),
      },
      include: { client: true, provider: providerWithVehicle },
    });
    this.marketplace.syncFromMission(id, MissionStatus.cancelled).catch((err) =>
      this.logger.error('Marketplace sync (cancel) failed:', err),
    );

    const otherId =
      userId === mission.clientId ? mission.providerId : mission.clientId;
    if (otherId) {
      await this.notifications
        .sendToUser(otherId, {
          title: 'Mission annulée',
          body: 'La mission a été annulée',
          data: { missionId: id, type: 'status_update', status: 'cancelled' },
        })
        .catch((err) => this.logger.error('Failed to notify cancel:', err));
    }

    return updated;
  }

  async getStats() {
    const statusCounts = await this.prisma.mission.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const totalRevenue = await this.prisma.mission.aggregate({
      where: { status: MissionStatus.delivered },
      _sum: { price: true },
    });

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const monthlyData = await this.prisma.mission.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, price: true, status: true },
    });

    const months: Record<string, { missions: number; revenue: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('fr-FR', { month: 'short' });
      months[key] = { missions: 0, revenue: 0 };
    }

    monthlyData.forEach((m) => {
      const key = m.createdAt.toLocaleDateString('fr-FR', { month: 'short' });
      if (months[key]) {
        months[key].missions++;
        if (m.status === MissionStatus.delivered) {
          months[key].revenue += Number(m.price);
        }
      }
    });

    return {
      statusCounts: statusCounts.reduce((acc, s) => {
        acc[s.status] = s._count._all;
        return acc;
      }, {} as Record<string, number>),
      totalRevenue: totalRevenue._sum.price || 0,
      monthly: Object.entries(months).map(([month, data]) => ({ month, ...data })),
    };
  }

  async updateProviderLocation(missionId: string, lat: number, lng: number) {
    return this.prisma.mission.update({
      where: { id: missionId },
      data: { providerLat: String(lat), providerLng: String(lng) },
      select: { id: true, providerLat: true, providerLng: true },
    });
  }

  async getProviderLocation(missionId: string) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { id: true, providerLat: true, providerLng: true, pickupLat: true, pickupLng: true, deliveryLat: true, deliveryLng: true, status: true, providerId: true },
    });
    return mission;
  }

  /**
   * Le prestataire enregistre le montant réel des frais administratifs avancés
   * et le justificatif associé (cf. CDC §14: remboursement sur justificatif).
   */
  async submitAdminFeeReceipt(missionId: string, providerId: string, actualFee: number, receiptUrl: string) {
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new BadRequestException('Mission introuvable');
    if (mission.providerId !== providerId) {
      throw new BadRequestException('Seul le prestataire assigné peut soumettre le justificatif');
    }
    const updated = await this.prisma.mission.update({
      where: { id: missionId },
      data: {
        adminFeeActual: Math.max(0, Math.round(actualFee)),
        adminFeeReceiptUrl: receiptUrl,
        adminFeeReimbursed: false,
      },
      include: { client: true },
    });

    // Notifier le client qu'un justificatif de frais a été déposé
    await this.notifications.sendToUser(updated.clientId, {
      title: 'Frais administratifs à rembourser',
      body: `Le prestataire a avancé ${updated.adminFeeActual} FCFA. Justificatif disponible.`,
      data: { missionId, type: 'admin_fee_receipt' },
    }).catch((err) => this.logger.error('Failed to notify client of admin fee:', err));

    return updated;
  }

  /**
   * L'admin valide que le client a remboursé les frais administratifs au prestataire.
   */
  async reimburseAdminFee(missionId: string) {
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new BadRequestException('Mission introuvable');
    if (!mission.adminFeeReceiptUrl) {
      throw new BadRequestException('Aucun justificatif soumis pour cette mission');
    }
    return this.prisma.mission.update({
      where: { id: missionId },
      data: { adminFeeReimbursed: true },
      include: { client: true, provider: providerWithVehicle },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markProviderPayoutsEligibleCron() {
    const now = new Date();
    const held = await this.prisma.mission.findMany({
      where: {
        status: MissionStatus.delivered,
        payoutStatus: MissionPayoutStatus.held,
        payoutEligibleAt: { lte: now },
      },
      select: { id: true, providerId: true, providerAmount: true },
    });
    if (held.length === 0) return;

    const result = await this.prisma.mission.updateMany({
      where: { id: { in: held.map((m) => m.id) } },
      data: { payoutStatus: MissionPayoutStatus.eligible },
    });
    this.logger.log(`${result.count} reversement(s) presta éligible(s) J+2`);

    for (const m of held) {
      if (!m.providerId) continue;
      const amount = Number(m.providerAmount || 0);
      this.notifications
        .sendToUser(m.providerId, {
          title: 'Reversement disponible',
          body: `${amount.toLocaleString()} FCFA prêts à être versés`,
          data: { missionId: m.id, type: 'provider_payout' },
        })
        .catch((err) => this.logger.error('Failed to notify provider payout:', err));
    }
  }

  async adminListPayouts() {
    return this.prisma.mission.findMany({
      where: {
        payoutStatus: { in: [MissionPayoutStatus.eligible, MissionPayoutStatus.paid_out] },
      },
      include: {
        provider: {
          select: { id: true, phone: true, firstName: true, lastName: true },
        },
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
      orderBy: { payoutEligibleAt: 'asc' },
    });
  }

  async adminMarkPaidOut(missionId: string) {
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new NotFoundException('Mission introuvable');
    if (mission.payoutStatus !== MissionPayoutStatus.eligible) {
      throw new BadRequestException('Reversement non éligible');
    }
    const updated = await this.prisma.mission.update({
      where: { id: missionId },
      data: {
        payoutStatus: MissionPayoutStatus.paid_out,
        paidOutAt: new Date(),
      },
      include: {
        provider: {
          select: { id: true, phone: true, firstName: true, lastName: true },
        },
      },
    });

    if (updated.providerId) {
      const amount = Number(updated.providerAmount || updated.price || 0);
      this.notifications
        .sendToUser(updated.providerId, {
          title: 'Reversement effectué',
          body: `${amount.toLocaleString()} FCFA ont été versés`,
          data: { missionId, type: 'provider_payout' },
        })
        .catch((err) => this.logger.error('Failed to notify paid out:', err));
    }

    return updated;
  }
}
