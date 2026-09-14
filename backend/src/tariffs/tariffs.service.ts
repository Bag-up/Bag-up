import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_TARIFF = {
  baseFare: 200,
  perKm: 110,
  expressMultiplier: 1.5,
  groupeMultiplier: 0.8,
  prioritaireMultiplier: 1.25,
  programmeMultiplier: 0.9,
  roundingFactor: 100,
};

@Injectable()
export class TariffsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive() {
    const tariff = await this.prisma.tariff.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!tariff) {
      return DEFAULT_TARIFF;
    }
    return {
      ...tariff,
      groupeMultiplier: (tariff as { groupeMultiplier?: number }).groupeMultiplier ?? 0.8,
    };
  }

  async findAll() {
    return this.prisma.tariff.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(data: {
    baseFare: number;
    perKm: number;
    expressMultiplier: number;
    groupeMultiplier?: number;
    prioritaireMultiplier?: number;
    programmeMultiplier: number;
    roundingFactor: number;
  }) {
    await this.prisma.tariff.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return this.prisma.tariff.create({
      data: {
        baseFare: data.baseFare,
        perKm: data.perKm,
        expressMultiplier: data.expressMultiplier,
        groupeMultiplier: data.groupeMultiplier ?? 0.8,
        prioritaireMultiplier: data.prioritaireMultiplier ?? 1.25,
        programmeMultiplier: data.programmeMultiplier,
        roundingFactor: data.roundingFactor,
        isActive: true,
      },
    });
  }

  async setActive(id: string) {
    await this.prisma.tariff.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return this.prisma.tariff.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async getInsuranceConfig() {
    const config = await this.prisma.insuranceConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      return {
        partnerName: '',
        partnerContact: '',
        coveragePlafond: 0,
        eligibilityMonths: 4,
        sinistreProcedure: '',
      };
    }
    return config;
  }

  async createInsuranceConfig(data: {
    partnerName: string;
    partnerContact: string;
    coveragePlafond: number;
    eligibilityMonths: number;
    sinistreProcedure: string;
  }) {
    await this.prisma.insuranceConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return this.prisma.insuranceConfig.create({
      data: { ...data, isActive: true },
    });
  }
}
