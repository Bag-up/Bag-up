import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MissionPayoutStatus, PaymentMethod, PaymentStatus, RideOfferStatus, RideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { CreateRideDto } from '../dto/create-ride.dto';
import { normalizeVehicleMode, vehicleModeLabel } from '../missions/vehicle-mode';

/** Rayon pour classer les chauffeurs (matching séquentiel). */
const MATCH_RADIUS_KM = 15;
const MAX_MATCH_CANDIDATES = 20;
/** Délai d’acceptation exclusif par chauffeur (secondes). */
const OFFER_TIMEOUT_SEC = 20;
/** Position presta considérée fraîche. */
const LOCATION_FRESH_MS = 30 * 60 * 1000;
/** Relancer une vague de matching si plus de candidats. */
const REMATCH_COOLDOWN_MS = 30 * 1000;
/** 0 % commission au lancement (aligné missions). */
const PROVIDER_COMMISSION_RATE = 0;
/** Délai avant éligibilité au reversement chauffeur. */
const PAYOUT_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

/** Ligne véhicule lisible en notif : « Blanc Peugeot 307 · AA996YV ». */
function vehicleIdentityLine(ride: {
  vehicleColor?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehiclePlate?: string | null;
}) {
  const car = [ride.vehicleColor, ride.vehicleBrand, ride.vehicleModel]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' ');
  const plate = ride.vehiclePlate ? String(ride.vehiclePlate).trim().toUpperCase() : '';
  return [car, plate].filter(Boolean).join(' · ');
}

const driverSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  rating: true,
  avatarUrl: true,
  vehicleType: true,
  vehicle: {
    select: {
      type: true,
      plate: true,
      brand: true,
      model: true,
      color: true,
    },
  },
} as const;

@Injectable()
export class RidesService implements OnModuleDestroy {
  private readonly logger = new Logger(RidesService.name);
  /** Expire l’offre exacte sans attendre le cron (clé = offerId). */
  private readonly offerTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly notifications: NotificationsService,
    private readonly loyalty: LoyaltyService,
  ) {}

  onModuleDestroy() {
    for (const timer of this.offerTimers.values()) clearTimeout(timer);
    this.offerTimers.clear();
  }

  private clearOfferTimer(offerId: string) {
    const timer = this.offerTimers.get(offerId);
    if (!timer) return;
    clearTimeout(timer);
    this.offerTimers.delete(offerId);
  }

  /** Passe au chauffeur suivant dès la fin de la fenêtre exclusive. */
  private scheduleOfferExpiry(offerId: string, expiresAt: Date) {
    this.clearOfferTimer(offerId);
    const delayMs = Math.max(0, expiresAt.getTime() - Date.now()) + 80;
    const timer = setTimeout(() => {
      this.offerTimers.delete(offerId);
      this.expireOfferAndContinue(offerId).catch((err) =>
        this.logger.error(`expireOffer ${offerId}:`, err),
      );
    }, delayMs);
    this.offerTimers.set(offerId, timer);
  }

  private async notifyDriversRideTaken(
    driverIds: string[],
    rideId: string,
  ) {
    const unique = [...new Set(driverIds.filter(Boolean))];
    await Promise.all(
      unique.map((driverId) =>
        this.notifications
          .sendToUser(driverId, {
            title: 'Course déjà prise',
            body: 'Un autre chauffeur a accepté cette course.',
            data: { rideId, type: 'ride_taken' },
          })
          .catch((err) =>
            this.logger.error(`Failed to notify ride_taken → ${driverId}:`, err),
          ),
      ),
    );
  }

  private eligibleDriverWhere(vehicleMode?: string | null) {
    const mode = normalizeVehicleMode(vehicleMode);
    // Sans mode moto/voiture → aucun candidat (évite notifs croisées)
    if (!mode) {
      return { id: '__no_vehicle_mode__', role: 'provider' as const };
    }
    const other = mode === 'moto' ? 'voiture' : 'moto';
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
        // Priorité au véhicule enregistré ; sinon vehicleType user
        {
          OR: [
            { vehicle: { is: { type: mode } } },
            {
              AND: [
                { vehicleType: mode },
                { OR: [{ vehicle: { is: null } }, { vehicle: { is: { type: mode } } }] },
              ],
            },
          ],
        },
        // Exclure explicitement l’autre mode s’il a une fiche véhicule
        { NOT: { vehicle: { is: { type: other } } } },
      ],
    };
  }

  /** Course terminée sans confirmation cash / paiement → chauffeur bloqué. */
  private async findUnconfirmedCompletedRide(driverId: string) {
    return this.prisma.ride.findFirst({
      where: {
        driverId,
        status: RideStatus.completed,
        cashConfirmedAt: null,
        payments: { none: { status: PaymentStatus.success } },
      },
      orderBy: { completedAt: 'desc' },
      include: {
        passenger: { select: { id: true, firstName: true, phone: true } },
      },
    });
  }

  private async assertDriverClearedForNewRides(driverId: string) {
    const pending = await this.findUnconfirmedCompletedRide(driverId);
    if (pending) {
      throw new BadRequestException(
        'Confirmez d’abord la réception du paiement cash de votre dernière course avant d’en accepter une nouvelle',
      );
    }
  }

  private async assertDriverCanTakeRides(driverId: string) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: {
        role: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
        isVerified: true,
        isActive: true,
        isAvailable: true,
        firstName: true,
        lastName: true,
        phone: true,
        rating: true,
        avatarUrl: true,
        vehicleType: true,
        vehicle: {
          select: { type: true, plate: true, brand: true, model: true, color: true },
        },
      },
    });
    if (!driver?.isActive || !driver.isVerified || driver.role !== 'provider') {
      throw new BadRequestException('Compte prestataire non autorisé');
    }
    const expiryOk =
      driver.subscriptionStatus === 'active' &&
      (!driver.subscriptionExpiry || new Date(driver.subscriptionExpiry) > new Date());
    if (!expiryOk) {
      throw new BadRequestException('Abonnement prestataire expiré');
    }
    if (!driver.avatarUrl) {
      throw new BadRequestException(
        'Ajoutez votre photo de profil pour que le client puisse vous reconnaître',
      );
    }
    const mode = normalizeVehicleMode(driver.vehicle?.type || driver.vehicleType);
    if (!mode) {
      throw new BadRequestException(
        'Les courses nécessitent une moto ou une voiture avec plaque et couleur',
      );
    }
    const plate = driver.vehicle?.plate?.trim();
    const color = driver.vehicle?.color?.trim();
    if (!plate || plate.length < 5) {
      throw new BadRequestException('Renseignez la plaque d’immatriculation de votre véhicule');
    }
    if (!color) {
      throw new BadRequestException('Renseignez la couleur de votre véhicule');
    }
    return driver;
  }

  private serialize(ride: any, extras?: { offer?: any }) {
    if (!ride) return ride;
    const payments = Array.isArray(ride.payments) ? ride.payments : [];
    const ratings = Array.isArray(ride.ratings) ? ride.ratings : [];
    const offer = extras?.offer;
    return {
      ...ride,
      estimatedPrice: Number(ride.estimatedPrice),
      finalPrice: ride.finalPrice != null ? Number(ride.finalPrice) : null,
      providerAmount: ride.providerAmount != null ? Number(ride.providerAmount) : null,
      kind: 'ride' as const,
      isPaid:
        !!ride.cashConfirmedAt ||
        payments.some((p: any) => p.status === 'success'),
      cashConfirmedAt: ride.cashConfirmedAt
        ? new Date(ride.cashConfirmedAt).toISOString()
        : null,
      needsCashConfirm:
        ride.status === RideStatus.completed &&
        !ride.cashConfirmedAt &&
        !payments.some((p: any) => p.status === 'success'),
      isRated: ratings.length > 0,
      matchingRank: ride.matchingRank ?? null,
      offerExpiresAt: offer?.expiresAt ? new Date(offer.expiresAt).toISOString() : null,
      offerDistanceKm:
        offer?.distanceKm != null && !Number.isNaN(Number(offer.distanceKm))
          ? Number(offer.distanceKm)
          : null,
      isExclusiveOffer: !!offer,
    };
  }

  private async touchDriverLocation(driverId: string, lat: number, lng: number) {
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    await this.prisma.user
      .update({
        where: { id: driverId },
        data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
      })
      .catch(() => {});
  }

  async create(dto: CreateRideDto, passengerId: string) {
    const mode = normalizeVehicleMode(dto.vehicleMode);
    if (!mode) {
      throw new BadRequestException('Choisissez moto ou voiture');
    }
    if (!dto.pickupAddress?.trim() || !dto.dropoffAddress?.trim()) {
      throw new BadRequestException('Départ et destination requis');
    }

    let distanceKm: number | null = null;
    let durationMin: number | null = null;
    let estimatedPrice =
      typeof dto.estimatedPrice === 'number' && dto.estimatedPrice > 0
        ? Math.round(dto.estimatedPrice)
        : null;

    const hasPickup =
      dto.pickupLat != null &&
      dto.pickupLng != null &&
      !Number.isNaN(parseFloat(dto.pickupLat)) &&
      !Number.isNaN(parseFloat(dto.pickupLng));
    const hasDropoff =
      dto.dropoffLat != null &&
      dto.dropoffLng != null &&
      !Number.isNaN(parseFloat(dto.dropoffLat)) &&
      !Number.isNaN(parseFloat(dto.dropoffLng));

    if (hasPickup && hasDropoff) {
      try {
        const route = await this.geo.routeDistance(
          { lat: parseFloat(dto.pickupLat!), lng: parseFloat(dto.pickupLng!) },
          { lat: parseFloat(dto.dropoffLat!), lng: parseFloat(dto.dropoffLng!) },
        );
        distanceKm = route.distanceKm;
        durationMin =
          route.source === 'route'
            ? route.durationMin
            : this.geo.estimateRideDuration(route.distanceKm);
        estimatedPrice = this.geo.estimateRidePrice(route.distanceKm, mode);
      } catch (err) {
        this.logger.warn(`Ride route estimate failed: ${err}`);
      }
    }

    if (estimatedPrice == null || estimatedPrice <= 0) {
      throw new BadRequestException('Impossible de calculer le prix de la course');
    }

    const ride = await this.prisma.ride.create({
      data: {
        status: RideStatus.searching,
        vehicleMode: mode,
        pickupAddress: dto.pickupAddress.trim(),
        dropoffAddress: dto.dropoffAddress.trim(),
        pickupLat: dto.pickupLat || null,
        pickupLng: dto.pickupLng || null,
        dropoffLat: dto.dropoffLat || null,
        dropoffLng: dto.dropoffLng || null,
        estimatedPrice,
        estimatedDistanceKm: distanceKm,
        estimatedDurationMin: durationMin,
        passengerId,
      },
      include: {
        passenger: { select: { id: true, firstName: true, phone: true } },
        driver: { select: driverSelect },
      },
    });

    this.startSequentialMatching(ride.id).catch((err) =>
      this.logger.error('Failed to start ride matching:', err),
    );

    return this.serialize(ride);
  }

  private async rankCandidates(
    ride: {
      id: string;
      vehicleMode: string | null;
      pickupLat?: string | null;
      pickupLng?: string | null;
      pickupAddress?: string | null;
    },
    opts?: { rematch?: boolean },
  ): Promise<Array<{ driverId: string; distanceKm: number | null }>> {
    const rematch = !!opts?.rematch;
    const providers = await this.prisma.user.findMany({
      where: this.eligibleDriverWhere(ride.vehicleMode),
      select: {
        id: true,
        zone: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
        avatarUrl: true,
        vehicle: { select: { plate: true, color: true, type: true } },
        vehicleType: true,
      },
    });

    const busy = await this.prisma.ride.findMany({
      where: {
        driverId: { in: providers.map((p) => p.id) },
        OR: [
          {
            status: {
              in: [
                RideStatus.assigned,
                RideStatus.driver_en_route,
                RideStatus.driver_arrived,
                RideStatus.in_progress,
              ],
            },
          },
          // Bloqué tant que le cash n’est pas confirmé
          {
            status: RideStatus.completed,
            cashConfirmedAt: null,
            payments: { none: { status: PaymentStatus.success } },
          },
        ],
      },
      select: { driverId: true },
    });
    const busySet = new Set(busy.map((b) => b.driverId).filter(Boolean) as string[]);

    const already = await this.prisma.rideOffer.findMany({
      where: {
        rideId: ride.id,
        status: rematch
          ? { in: [RideOfferStatus.accepted, RideOfferStatus.pending] }
          : {
              in: [
                RideOfferStatus.refused,
                RideOfferStatus.expired,
                RideOfferStatus.accepted,
                RideOfferStatus.cancelled,
                RideOfferStatus.pending,
              ],
            },
      },
      select: { driverId: true },
    });
    const alreadySet = new Set(already.map((a) => a.driverId));

    const pickupLat =
      ride.pickupLat != null ? parseFloat(ride.pickupLat) : Number.NaN;
    const pickupLng =
      ride.pickupLng != null ? parseFloat(ride.pickupLng) : Number.NaN;
    const hasPickup = !Number.isNaN(pickupLat) && !Number.isNaN(pickupLng);
    const now = Date.now();

    const missionLocs = await this.prisma.mission.findMany({
      where: {
        providerId: { in: providers.map((p) => p.id) },
        providerLat: { not: null },
        providerLng: { not: null },
        status: { in: ['accepted', 'en_route', 'picked_up', 'in_progress'] },
      },
      select: { providerId: true, providerLat: true, providerLng: true },
      distinct: ['providerId'],
    });
    const missionMap = new Map(
      missionLocs
        .filter((m) => m.providerId)
        .map((m) => [
          m.providerId!,
          {
            lat: parseFloat(m.providerLat!),
            lng: parseFloat(m.providerLng!),
          },
        ]),
    );

    const pickupZone =
      ride.pickupAddress?.split(',').pop()?.trim()?.toLowerCase() || '';

    type Cand = { driverId: string; distanceKm: number | null; hasLoc: boolean };
    const ranked: Cand[] = [];

    for (const p of providers) {
      if (busySet.has(p.id) || alreadySet.has(p.id)) continue;
      const pMode = normalizeVehicleMode(p.vehicle?.type || p.vehicleType);
      const required = normalizeVehicleMode(ride.vehicleMode);
      if (!required || pMode !== required) continue;
      const plate = p.vehicle?.plate?.trim();
      const color = p.vehicle?.color?.trim();
      if (!p.avatarUrl || !plate || plate.length < 5 || !color) continue;

      let lat: number | null = null;
      let lng: number | null = null;
      if (
        p.lastLat != null &&
        p.lastLng != null &&
        p.lastLocationAt &&
        now - new Date(p.lastLocationAt).getTime() <= LOCATION_FRESH_MS
      ) {
        lat = p.lastLat;
        lng = p.lastLng;
      } else {
        const m = missionMap.get(p.id);
        if (m && !Number.isNaN(m.lat) && !Number.isNaN(m.lng)) {
          lat = m.lat;
          lng = m.lng;
        }
      }

      if (hasPickup && lat != null && lng != null) {
        const distanceKm = this.geo.haversineDistance(
          { lat: pickupLat, lng: pickupLng },
          { lat, lng },
        );
        if (distanceKm > MATCH_RADIUS_KM) continue;
        ranked.push({ driverId: p.id, distanceKm, hasLoc: true });
        continue;
      }

      const zoneOk =
        !!p.zone &&
        !!pickupZone &&
        (p.zone.toLowerCase().includes(pickupZone) ||
          pickupZone.includes(p.zone.toLowerCase()));
      if (zoneOk || !hasPickup) {
        ranked.push({ driverId: p.id, distanceKm: null, hasLoc: false });
      }
    }

    ranked.sort((a, b) => {
      if (a.hasLoc && b.hasLoc) return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
      if (a.hasLoc && !b.hasLoc) return -1;
      if (!a.hasLoc && b.hasLoc) return 1;
      return 0;
    });

    return ranked.slice(0, MAX_MATCH_CANDIDATES).map((c) => ({
      driverId: c.driverId,
      distanceKm: c.distanceKm,
    }));
  }

  private async startSequentialMatching(rideId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== RideStatus.searching) return;

    const pending = await this.prisma.rideOffer.findFirst({
      where: { rideId, status: RideOfferStatus.pending },
    });
    if (pending) return;

    await this.offerToNext(rideId, { rematch: false });
  }

  private async offerToNext(rideId: string, opts?: { rematch?: boolean }) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== RideStatus.searching) return;

    const existingPending = await this.prisma.rideOffer.findFirst({
      where: { rideId, status: RideOfferStatus.pending },
    });
    if (existingPending) return;

    const rematch = !!opts?.rematch;
    const candidates = await this.rankCandidates(ride, { rematch });
    if (candidates.length === 0) {
      await this.prisma.ride.update({
        where: { id: rideId },
        data: { matchingRank: null },
      });
      this.logger.warn(
        `Ride ${rideId}: plus de candidats${rematch ? ' (rematch)' : ''} — attente`,
      );
      return;
    }

    const next = candidates[0];
    const prevCount = await this.prisma.rideOffer.count({ where: { rideId } });
    const rank = prevCount + 1;
    const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SEC * 1000);

    const offer = await this.prisma.rideOffer.create({
      data: {
        rideId,
        driverId: next.driverId,
        status: RideOfferStatus.pending,
        rank,
        distanceKm: next.distanceKm,
        expiresAt,
      },
    });

    await this.prisma.ride.update({
      where: { id: rideId },
      data: { matchingRank: rank },
    });

    const modeLabel = vehicleModeLabel(ride.vehicleMode);
    const title = modeLabel ? `Course ${modeLabel} pour vous` : 'Course pour vous';
    const distHint =
      next.distanceKm != null
        ? ` · ~${next.distanceKm.toFixed(1)} km`
        : '';
    await this.notifications
      .sendToUser(next.driverId, {
        title,
        body: `${ride.pickupAddress} → ${ride.dropoffAddress}${distHint} (${OFFER_TIMEOUT_SEC}s)`,
        data: {
          rideId,
          type: 'ride_offer',
          offerId: offer.id,
          expiresAt: expiresAt.toISOString(),
          vehicleMode: ride.vehicleMode || '',
        },
      })
      .catch((err) => this.logger.error('Failed to notify offered driver:', err));

    this.scheduleOfferExpiry(offer.id, expiresAt);

    this.logger.log(
      `Ride ${rideId}: offre #${rank} → driver ${next.driverId}${rematch ? ' (rematch)' : ''}`,
    );
  }

  private async expireOfferAndContinue(offerId: string) {
    this.clearOfferTimer(offerId);
    const updated = await this.prisma.rideOffer.updateMany({
      where: { id: offerId, status: RideOfferStatus.pending },
      data: { status: RideOfferStatus.expired, respondedAt: new Date() },
    });
    if (updated.count === 0) return;
    const offer = await this.prisma.rideOffer.findUnique({ where: { id: offerId } });
    if (!offer) return;
    this.logger.log(`Ride ${offer.rideId}: offre expirée pour ${offer.driverId}`);
    await this.offerToNext(offer.rideId);
  }

  async findAll() {
    const rides = await this.prisma.ride.findMany({
      include: {
        passenger: { select: { id: true, firstName: true, lastName: true, phone: true } },
        driver: { select: driverSelect },
        payments: { select: { id: true, status: true, amount: true } },
        ratings: { select: { id: true, score: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rides.map((r) => this.serialize(r));
  }

  async findById(id: string, userId: string, opts?: { staff?: boolean }) {
    const ride = await this.prisma.ride.findUnique({
      where: { id },
      include: {
        passenger: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
        driver: { select: driverSelect },
        payments: {
          select: {
            id: true,
            status: true,
            amount: true,
            method: true,
            provider: true,
            createdAt: true,
          },
        },
        ratings: { select: { id: true, score: true, comment: true, raterId: true, createdAt: true } },
        offers: opts?.staff
          ? {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: {
                driver: {
                  select: { id: true, firstName: true, lastName: true, phone: true },
                },
              },
            }
          : false,
      },
    });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (
      !opts?.staff &&
      ride.passengerId !== userId &&
      ride.driverId !== userId
    ) {
      throw new BadRequestException('Accès non autorisé');
    }

    let offerExtras: { offer?: any } | undefined;
    if (!opts?.staff && ride.status === RideStatus.searching) {
      const pending = await this.prisma.rideOffer.findFirst({
        where: { rideId: id, status: RideOfferStatus.pending },
        orderBy: { createdAt: 'desc' },
      });
      // Détails d’offre uniquement pour le chauffeur ciblé
      if (pending && pending.driverId === userId) {
        offerExtras = { offer: pending };
      }
    }

    return this.serialize(ride, offerExtras);
  }

  /** Détail course pour le back-office (staff). */
  async findByIdStaff(id: string) {
    return this.findById(id, '', { staff: true });
  }

  async findMine(passengerId: string) {
    const rides = await this.prisma.ride.findMany({
      where: { passengerId },
      include: {
        driver: { select: driverSelect },
        payments: { select: { status: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rides.map((r) => this.serialize(r));
  }

  async findByDriver(driverId: string) {
    const rides = await this.prisma.ride.findMany({
      where: { driverId },
      include: {
        passenger: { select: { id: true, firstName: true, phone: true } },
        payments: { select: { status: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rides.map((r) => this.serialize(r));
  }

  /** Chauffeur confirme avoir reçu le cash du client → enregistré backoffice. */
  async confirmCashPayment(id: string, driverId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id },
      include: { payments: { select: { status: true } } },
    });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (ride.driverId !== driverId) {
      throw new BadRequestException('Seul le chauffeur de la course peut confirmer le paiement');
    }
    if (ride.status !== RideStatus.completed) {
      throw new BadRequestException('La course doit être terminée avant de confirmer le paiement');
    }
    if (ride.cashConfirmedAt || ride.payments.some((p) => p.status === PaymentStatus.success)) {
      return this.findById(id, driverId);
    }

    const amount = Number(ride.finalPrice ?? ride.estimatedPrice);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.ride.update({
        where: { id },
        data: {
          cashConfirmedAt: now,
          providerAmount: Math.round(amount * (1 - PROVIDER_COMMISSION_RATE)),
          // Cash déjà chez le chauffeur — pas d’escrow
          payoutStatus: MissionPayoutStatus.paid_out,
          payoutEligibleAt: now,
        },
      }),
      this.prisma.payment.create({
        data: {
          amount,
          method: PaymentMethod.cash,
          status: PaymentStatus.success,
          provider: 'cash_to_driver',
          currency: 'XOF',
          userId: ride.passengerId,
          rideId: id,
          transactionId: `CASH-${id.slice(0, 8).toUpperCase()}`,
        },
      }),
    ]);

    await this.notifications
      .sendToUser(ride.passengerId, {
        title: 'Paiement confirmé',
        body: 'Le chauffeur a confirmé la réception de votre paiement.',
        data: { rideId: id, type: 'ride_payment_confirmed' },
      })
      .catch(() => {});

    return this.findById(id, driverId);
  }

  async pendingCashConfirm(driverId: string) {
    const ride = await this.findUnconfirmedCompletedRide(driverId);
    return ride ? this.serialize(ride) : null;
  }

  async findAvailable(
    lat?: number,
    lng?: number,
    _radiusKm = MATCH_RADIUS_KM,
    driverId?: string,
  ) {
    if (!driverId) return [];

    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      await this.touchDriverLocation(driverId, lat, lng);
    }

    // Tant que le cash n’est pas confirmé → aucune nouvelle offre
    const unpaid = await this.findUnconfirmedCompletedRide(driverId);
    if (unpaid) {
      return [];
    }

    const now = new Date();
    const offers = await this.prisma.rideOffer.findMany({
      where: {
        driverId,
        status: RideOfferStatus.pending,
        expiresAt: { gt: now },
        ride: { status: RideStatus.searching },
      },
      include: {
        ride: {
          include: {
            passenger: { select: { id: true, firstName: true } },
            payments: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Double filtre mode véhicule (sécurité)
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: { vehicleType: true, vehicle: { select: { type: true } } },
    });
    const driverMode = normalizeVehicleMode(driver?.vehicle?.type || driver?.vehicleType);

    return offers
      .filter((o) => {
        const rideMode = normalizeVehicleMode(o.ride.vehicleMode);
        return !!rideMode && rideMode === driverMode;
      })
      .map((o) => this.serialize(o.ride, { offer: o }));
  }

  async accept(id: string, driverId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id } });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (ride.status !== RideStatus.searching) {
      throw new BadRequestException('Course déjà prise');
    }

    const now = new Date();
    const offer = await this.prisma.rideOffer.findFirst({
      where: {
        rideId: id,
        driverId,
        status: RideOfferStatus.pending,
        expiresAt: { gt: now },
      },
    });
    if (!offer) {
      throw new BadRequestException('Course déjà prise ou délai dépassé');
    }

    const driver = await this.assertDriverCanTakeRides(driverId);
    await this.assertDriverClearedForNewRides(driverId);
    const providerMode = normalizeVehicleMode(driver.vehicle?.type || driver.vehicleType);
    const required = normalizeVehicleMode(ride.vehicleMode);
    if (required && providerMode !== required) {
      throw new BadRequestException(
        `Cette course nécessite une ${vehicleModeLabel(required).toLowerCase()}`,
      );
    }

    const driverName = [driver.firstName, driver.lastName].filter(Boolean).join(' ').trim();

    const claimed = await this.prisma.ride.updateMany({
      where: { id, status: RideStatus.searching },
      data: {
        driverId,
        status: RideStatus.assigned,
        assignedAt: new Date(),
        driverName: driverName || driver.firstName,
        driverPhone: driver.phone,
        driverRating: driver.rating,
        vehicleType: providerMode || driver.vehicleType,
        vehiclePlate: driver.vehicle?.plate || null,
        vehicleBrand: driver.vehicle?.brand || null,
        vehicleModel: driver.vehicle?.model || null,
        vehicleColor: driver.vehicle?.color || null,
        matchingRank: offer.rank,
      },
    });
    if (claimed.count === 0) {
      this.clearOfferTimer(offer.id);
      await this.prisma.rideOffer.updateMany({
        where: { id: offer.id, status: RideOfferStatus.pending },
        data: { status: RideOfferStatus.cancelled, respondedAt: now },
      });
      throw new BadRequestException('Course déjà prise');
    }

    this.clearOfferTimer(offer.id);
    await this.prisma.rideOffer.update({
      where: { id: offer.id },
      data: { status: RideOfferStatus.accepted, respondedAt: now },
    });

    const otherPending = await this.prisma.rideOffer.findMany({
      where: {
        rideId: id,
        status: RideOfferStatus.pending,
        id: { not: offer.id },
      },
      select: { id: true, driverId: true },
    });
    if (otherPending.length > 0) {
      for (const o of otherPending) this.clearOfferTimer(o.id);
      await this.prisma.rideOffer.updateMany({
        where: {
          rideId: id,
          status: RideOfferStatus.pending,
          id: { not: offer.id },
        },
        data: { status: RideOfferStatus.cancelled, respondedAt: now },
      });
      await this.notifyDriversRideTaken(
        otherPending.map((o) => o.driverId),
        id,
      );
    }

    const updated = await this.prisma.ride.findUnique({
      where: { id },
      include: {
        passenger: { select: { id: true, firstName: true, phone: true } },
        driver: { select: driverSelect },
      },
    });
    if (!updated) throw new NotFoundException('Course introuvable');

    const plate = updated.vehiclePlate;
    const identity = vehicleIdentityLine(updated);
    const vehicleHint = [vehicleModeLabel(updated.vehicleType), plate]
      .filter(Boolean)
      .join(' · ');

    await this.notifications
      .sendToUser(ride.passengerId, {
        title: 'Chauffeur trouvé !',
        body: identity
          ? `${identity} arrive`
          : vehicleHint
            ? `${updated.driverName} arrive · ${vehicleHint}`
            : `${updated.driverName} a accepté votre course.`,
        data: { rideId: id, type: 'ride_assigned' },
      })
      .catch((err) => this.logger.error('Failed to notify passenger:', err));

    return this.serialize(updated);
  }

  async refuse(id: string, driverId: string) {
    const now = new Date();
    const offer = await this.prisma.rideOffer.findFirst({
      where: {
        rideId: id,
        driverId,
        status: RideOfferStatus.pending,
      },
    });
    if (!offer) {
      throw new BadRequestException('Aucune offre active pour cette course');
    }

    this.clearOfferTimer(offer.id);
    const updated = await this.prisma.rideOffer.updateMany({
      where: { id: offer.id, status: RideOfferStatus.pending },
      data: { status: RideOfferStatus.refused, respondedAt: now },
    });
    if (updated.count === 0) {
      throw new BadRequestException('Offre déjà traitée');
    }

    this.logger.log(`Ride ${id}: refus par ${driverId}`);
    await this.offerToNext(id);
    return { ok: true, rideId: id };
  }

  /** Passager : « Je suis ici » — notifie le chauffeur et enregistre la position. */
  async markPassengerReady(
    id: string,
    userId: string,
    coords?: { lat?: number; lng?: number },
  ) {
    const ride = await this.prisma.ride.findUnique({ where: { id } });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (ride.passengerId !== userId) {
      throw new BadRequestException('Seul le passager peut signaler sa présence');
    }
    const ok: RideStatus[] = [
      RideStatus.assigned,
      RideStatus.driver_en_route,
      RideStatus.driver_arrived,
    ];
    if (!ok.includes(ride.status)) {
      throw new BadRequestException('Signalez votre présence quand le chauffeur est en route');
    }

    const firstTime = !ride.passengerReadyAt;
    const lat =
      coords?.lat != null && !Number.isNaN(coords.lat) ? String(coords.lat) : ride.passengerLat;
    const lng =
      coords?.lng != null && !Number.isNaN(coords.lng) ? String(coords.lng) : ride.passengerLng;

    const updated = await this.prisma.ride.update({
      where: { id },
      data: {
        passengerReadyAt: ride.passengerReadyAt || new Date(),
        ...(lat ? { passengerLat: lat } : {}),
        ...(lng ? { passengerLng: lng } : {}),
      },
      include: {
        passenger: { select: { id: true, firstName: true, phone: true } },
        driver: { select: driverSelect },
      },
    });

    if (firstTime && ride.driverId) {
      const name = updated.passenger?.firstName || 'Le passager';
      await this.notifications
        .sendToUser(ride.driverId, {
          title: `${name} est sur place`,
          body: 'Le client a confirmé : je suis ici. Vous pouvez foncer au point de prise en charge.',
          data: { rideId: id, type: 'ride_passenger_ready' },
        })
        .catch((err) => this.logger.error('Failed to notify driver passenger ready:', err));
    }

    return this.serialize(updated);
  }

  async cancel(id: string, userId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id } });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (ride.passengerId !== userId && ride.driverId !== userId) {
      throw new BadRequestException('Accès non autorisé');
    }
    if (ride.status === RideStatus.completed || ride.status === RideStatus.cancelled) {
      throw new BadRequestException('Cette course est déjà terminée ou annulée');
    }
    if (ride.status === RideStatus.in_progress) {
      throw new BadRequestException(
        'Impossible d’annuler une course en cours — contactez le support si besoin',
      );
    }
    // Annulation libre jusqu’à l’arrivée du chauffeur (searching → driver_arrived)
    const freeCancel: RideStatus[] = [
      RideStatus.searching,
      RideStatus.assigned,
      RideStatus.driver_en_route,
      RideStatus.driver_arrived,
    ];
    if (!freeCancel.includes(ride.status)) {
      throw new BadRequestException('Cette course ne peut plus être annulée');
    }

    const updated = await this.prisma.ride.update({
      where: { id },
      data: { status: RideStatus.cancelled, cancelledAt: new Date() },
      include: {
        passenger: { select: { id: true, firstName: true, phone: true } },
        driver: { select: driverSelect },
      },
    });

    const pendingOffers = await this.prisma.rideOffer.findMany({
      where: { rideId: id, status: RideOfferStatus.pending },
      select: { id: true, driverId: true },
    });
    if (pendingOffers.length > 0) {
      for (const o of pendingOffers) this.clearOfferTimer(o.id);
      await this.prisma.rideOffer.updateMany({
        where: { rideId: id, status: RideOfferStatus.pending },
        data: { status: RideOfferStatus.cancelled, respondedAt: new Date() },
      });
    }

    const notifyId =
      userId === ride.passengerId ? ride.driverId : ride.passengerId;
    if (notifyId) {
      const byPassenger = userId === ride.passengerId;
      await this.notifications
        .sendToUser(notifyId, {
          title: 'Course annulée',
          body: byPassenger
            ? 'Le passager a annulé la course.'
            : 'Le chauffeur a annulé la course.',
          data: { rideId: id, type: 'ride_cancelled' },
        })
        .catch(() => {});
    }

    // Prévenir le chauffeur qui avait l’offre exclusive
    if (ride.status === RideStatus.searching) {
      for (const o of pendingOffers) {
        if (o.driverId === notifyId) continue;
        await this.notifications
          .sendToUser(o.driverId, {
            title: 'Course annulée',
            body: 'Le passager a annulé — offre retirée.',
            data: { rideId: id, type: 'ride_offer_cancelled' },
          })
          .catch(() => {});
      }
    }

    return this.serialize(updated);
  }

  /** Transitions chauffeur : assigned → … → completed */
  async updateStatus(id: string, status: RideStatus, userId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id } });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (ride.driverId !== userId) {
      throw new BadRequestException('Seul le chauffeur assigné peut mettre à jour le statut');
    }

    const allowed: Record<string, RideStatus[]> = {
      [RideStatus.assigned]: [RideStatus.driver_en_route, RideStatus.cancelled],
      [RideStatus.driver_en_route]: [RideStatus.driver_arrived, RideStatus.cancelled],
      [RideStatus.driver_arrived]: [RideStatus.in_progress, RideStatus.cancelled],
      [RideStatus.in_progress]: [RideStatus.completed],
    };
    const nextOk = allowed[ride.status] || [];
    if (!nextOk.includes(status)) {
      throw new BadRequestException(
        `Transition invalide : ${ride.status} → ${status}`,
      );
    }

    const data: Record<string, unknown> = { status };
    if (status === RideStatus.completed) {
      data.finalPrice = ride.estimatedPrice;
      data.completedAt = new Date();
    }
    if (status === RideStatus.cancelled) {
      data.cancelledAt = new Date();
      if (
        ride.payoutStatus === MissionPayoutStatus.held ||
        ride.payoutStatus === MissionPayoutStatus.eligible
      ) {
        data.payoutStatus = MissionPayoutStatus.cancelled;
      }
    }

    const updated = await this.prisma.ride.update({
      where: { id },
      data,
      include: {
        passenger: { select: { id: true, firstName: true, phone: true } },
        driver: { select: driverSelect },
      },
    });

    const titles: Partial<Record<RideStatus, string>> = {
      [RideStatus.driver_en_route]: 'Chauffeur en route',
      [RideStatus.driver_arrived]: 'Chauffeur arrivé',
      [RideStatus.in_progress]: 'Course démarrée',
      [RideStatus.completed]: 'Course terminée',
      [RideStatus.cancelled]: 'Course annulée',
    };
    const title = titles[status];
    if (title) {
      const identity = vehicleIdentityLine(updated);
      const body =
        status === RideStatus.driver_arrived
          ? identity
            ? `${identity} vous attend au départ`
            : `${updated.driverName || 'Votre chauffeur'} vous attend au départ.`
          : status === RideStatus.driver_en_route
            ? identity
              ? `${identity} est en route`
              : `${updated.driverName || 'Votre chauffeur'} est en route.`
            : status === RideStatus.completed
              ? `Merci d’avoir voyagé avec Bag’up.`
              : identity
                ? identity
                : `${updated.driverName || 'Votre chauffeur'} · mise à jour`;
      await this.notifications
        .sendToUser(ride.passengerId, {
          title,
          body,
          data: { rideId: id, type: 'ride_status', status },
        })
        .catch(() => {});
    }

    if (status === RideStatus.completed) {
      this.loyalty.syncProgress(ride.passengerId).catch((err) =>
        this.logger.error('Loyalty sync (ride) failed:', err),
      );
    }

    return this.serialize(updated);
  }

  async updateLocation(id: string, lat: number, lng: number, driverId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id } });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (ride.driverId !== driverId) {
      throw new BadRequestException('Seul le chauffeur assigné peut envoyer sa position');
    }
    if (
      [
        RideStatus.searching,
        RideStatus.completed,
        RideStatus.cancelled,
      ].includes(ride.status as any)
    ) {
      throw new BadRequestException('Position non applicable pour ce statut');
    }

    const data: {
      driverLat: string;
      driverLng: string;
      status?: RideStatus;
    } = {
      driverLat: String(lat),
      driverLng: String(lng),
    };
    // Premier ping GPS : passe en « en route » si encore assigné
    if (ride.status === RideStatus.assigned) {
      data.status = RideStatus.driver_en_route;
    }

    const updated = await this.prisma.ride.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        driverLat: true,
        driverLng: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
      },
    });

    await this.touchDriverLocation(driverId, lat, lng);

    return {
      ...updated,
      ...this.computeEtas(updated, lat, lng),
    };
  }

  async getLocation(id: string, userId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        passengerId: true,
        driverId: true,
        driverLat: true,
        driverLng: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
        passengerReadyAt: true,
        passengerLat: true,
        passengerLng: true,
      },
    });
    if (!ride) throw new NotFoundException('Course introuvable');
    if (ride.passengerId !== userId && ride.driverId !== userId) {
      throw new BadRequestException('Accès non autorisé');
    }
    const lat = ride.driverLat ? parseFloat(ride.driverLat) : null;
    const lng = ride.driverLng ? parseFloat(ride.driverLng) : null;
    return {
      id: ride.id,
      status: ride.status,
      driverLat: ride.driverLat,
      driverLng: ride.driverLng,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      dropoffLat: ride.dropoffLat,
      dropoffLng: ride.dropoffLng,
      passengerReadyAt: ride.passengerReadyAt,
      passengerLat: ride.passengerLat,
      passengerLng: ride.passengerLng,
      ...(lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
        ? this.computeEtas(ride, lat, lng)
        : { etaToPickupMin: null, etaToDropoffMin: null, distanceToTargetKm: null }),
    };
  }

  private computeEtas(
    ride: {
      status: string;
      pickupLat?: string | null;
      pickupLng?: string | null;
      dropoffLat?: string | null;
      dropoffLng?: string | null;
    },
    driverLat: number,
    driverLng: number,
  ) {
    const avgSpeedKmh = 28;
    const toMin = (km: number) => Math.max(1, Math.ceil((km / avgSpeedKmh) * 60));

    let etaToPickupMin: number | null = null;
    let etaToDropoffMin: number | null = null;
    let distanceToTargetKm: number | null = null;

    const beforePickup = (
      [
        RideStatus.assigned,
        RideStatus.driver_en_route,
        RideStatus.driver_arrived,
      ] as string[]
    ).includes(ride.status);

    if (
      beforePickup &&
      ride.pickupLat &&
      ride.pickupLng
    ) {
      const km = this.geo.haversineDistance(
        { lat: driverLat, lng: driverLng },
        { lat: parseFloat(ride.pickupLat), lng: parseFloat(ride.pickupLng) },
      );
      etaToPickupMin = ride.status === RideStatus.driver_arrived ? 0 : toMin(km);
      distanceToTargetKm = Math.round(km * 10) / 10;
    } else if (
      ride.status === RideStatus.in_progress &&
      ride.dropoffLat &&
      ride.dropoffLng
    ) {
      const km = this.geo.haversineDistance(
        { lat: driverLat, lng: driverLng },
        { lat: parseFloat(ride.dropoffLat), lng: parseFloat(ride.dropoffLng) },
      );
      etaToDropoffMin = toMin(km);
      distanceToTargetKm = Math.round(km * 10) / 10;
    }

    return { etaToPickupMin, etaToDropoffMin, distanceToTargetKm };
  }

  /**
   * Après paiement client réussi : le gain chauffeur passe en escrow J+2
   * (même logique que les missions livraison).
   */
  async applyPaymentSuccess(rideId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride?.driverId) return null;
    if (ride.status !== RideStatus.completed) {
      this.logger.warn(`Ride ${rideId}: paiement reçu mais course non terminée`);
      return null;
    }
    if (
      ride.payoutStatus === MissionPayoutStatus.held ||
      ride.payoutStatus === MissionPayoutStatus.eligible ||
      ride.payoutStatus === MissionPayoutStatus.paid_out
    ) {
      return ride;
    }

    const price = Number(ride.finalPrice ?? ride.estimatedPrice);
    const providerAmount = Math.round(price * (1 - PROVIDER_COMMISSION_RATE));
    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        providerAmount,
        payoutStatus: MissionPayoutStatus.held,
        payoutEligibleAt: new Date(Date.now() + PAYOUT_DELAY_MS),
      },
      include: {
        passenger: { select: { id: true, firstName: true, phone: true } },
        driver: { select: driverSelect },
      },
    });

    this.notifications
      .sendToUser(ride.driverId, {
        title: 'Paiement reçu',
        body: `${providerAmount.toLocaleString('fr-FR')} FCFA en attente (reversement J+2)`,
        data: { rideId, type: 'provider_payout' },
      })
      .catch((err) => this.logger.error('Failed to notify driver payout held:', err));

    return this.serialize(updated);
  }

  @Cron('*/15 * * * * *')
  async processRideOffersCron() {
    // Filet de sécurité : l’expiration principale est scheduleOfferExpiry (setTimeout exact).
    const now = new Date();
    const expired = await this.prisma.rideOffer.findMany({
      where: {
        status: RideOfferStatus.pending,
        expiresAt: { lte: now },
      },
      select: { id: true },
      take: 50,
    });
    for (const o of expired) {
      await this.expireOfferAndContinue(o.id);
    }

    // Rematch : courses searching sans offre pending, dernière activité > cooldown
    const searching = await this.prisma.ride.findMany({
      where: { status: RideStatus.searching },
      select: { id: true, updatedAt: true },
      take: 40,
    });
    for (const r of searching) {
      const pending = await this.prisma.rideOffer.findFirst({
        where: { rideId: r.id, status: RideOfferStatus.pending },
        select: { id: true },
      });
      if (pending) continue;

      const lastOffer = await this.prisma.rideOffer.findFirst({
        where: { rideId: r.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, respondedAt: true },
      });
      if (!lastOffer) {
        await this.offerToNext(r.id);
        continue;
      }
      const lastAt = lastOffer.respondedAt || lastOffer.createdAt;
      if (Date.now() - new Date(lastAt).getTime() < REMATCH_COOLDOWN_MS) continue;
      await this.offerToNext(r.id, { rematch: true });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markProviderPayoutsEligibleCron() {
    const now = new Date();
    const held = await this.prisma.ride.findMany({
      where: {
        status: RideStatus.completed,
        payoutStatus: MissionPayoutStatus.held,
        payoutEligibleAt: { lte: now },
      },
      select: { id: true, driverId: true, providerAmount: true },
    });
    if (held.length === 0) return;

    const result = await this.prisma.ride.updateMany({
      where: { id: { in: held.map((r) => r.id) } },
      data: { payoutStatus: MissionPayoutStatus.eligible },
    });
    this.logger.log(`${result.count} reversement(s) course éligible(s) J+2`);

    for (const r of held) {
      if (!r.driverId) continue;
      const amount = Number(r.providerAmount || 0);
      this.notifications
        .sendToUser(r.driverId, {
          title: 'Reversement course disponible',
          body: `${amount.toLocaleString('fr-FR')} FCFA prêts à être versés`,
          data: { rideId: r.id, type: 'provider_payout' },
        })
        .catch((err) => this.logger.error('Failed to notify driver payout:', err));
    }
  }
}
