import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from '../dto/rating.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRatingDto, raterId: string) {
    const hasMission = !!dto.missionId;
    const hasRide = !!dto.rideId;
    if (hasMission === hasRide) {
      throw new BadRequestException('Indiquez missionId ou rideId (un seul)');
    }

    if (hasRide) {
      const ride = await this.prisma.ride.findUnique({
        where: { id: dto.rideId! },
        include: { driver: true, passenger: true },
      });
      if (!ride) throw new NotFoundException('Course introuvable');
      if (ride.status !== 'completed') {
        throw new BadRequestException('La course doit être terminée pour être évaluée');
      }
      if (ride.passengerId !== raterId) {
        throw new BadRequestException('Seul le passager peut noter cette course');
      }
      if (!ride.driverId || ride.driverId !== dto.ratedId) {
        throw new BadRequestException('Chauffeur invalide pour cette note');
      }

      const existing = await this.prisma.rating.findFirst({
        where: { rideId: dto.rideId, raterId },
      });
      if (existing) throw new BadRequestException('Vous avez déjà évalué cette course');

      const rating = await this.prisma.rating.create({
        data: {
          score: dto.score,
          comment: dto.comment,
          raterId,
          ratedId: dto.ratedId,
          rideId: dto.rideId,
        },
        include: {
          rater: { select: { id: true, firstName: true } },
          ride: true,
        },
      });
      await this.recalculateUserRating(dto.ratedId);
      return rating;
    }

    const mission = await this.prisma.mission.findUnique({
      where: { id: dto.missionId! },
      include: { client: true, provider: true },
    });

    if (!mission) throw new NotFoundException('Mission introuvable');
    if (mission.status !== 'delivered') {
      throw new BadRequestException('La mission doit être terminée pour être évaluée');
    }

    const existing = await this.prisma.rating.findFirst({
      where: { missionId: dto.missionId, raterId },
    });
    if (existing) throw new BadRequestException('Vous avez déjà évalué cette mission');

    const rating = await this.prisma.rating.create({
      data: {
        score: dto.score,
        comment: dto.comment,
        raterId,
        ratedId: dto.ratedId,
        missionId: dto.missionId,
      },
      include: { rater: { select: { id: true, firstName: true } }, mission: true },
    });

    await this.recalculateUserRating(dto.ratedId);

    return rating;
  }

  async findByUser(userId: string) {
    return this.prisma.rating.findMany({
      where: { ratedId: userId },
      include: {
        rater: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        mission: { select: { id: true, serviceType: true } },
        ride: { select: { id: true, vehicleMode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByMission(missionId: string) {
    return this.prisma.rating.findMany({
      where: { missionId },
      include: {
        rater: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async findByRide(rideId: string) {
    return this.prisma.rating.findMany({
      where: { rideId },
      include: {
        rater: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async findByRater(raterId: string) {
    return this.prisma.rating.findMany({
      where: { raterId },
      include: {
        mission: { select: { id: true, serviceType: true } },
        ride: { select: { id: true, vehicleMode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async recalculateUserRating(userId: string) {
    const result = await this.prisma.rating.aggregate({
      where: { ratedId: userId },
      _avg: { score: true },
      _count: { score: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        rating: Math.round((result._avg.score || 0) * 10) / 10,
        totalRatings: result._count.score,
      },
    });
  }
}
