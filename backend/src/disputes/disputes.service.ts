import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { missionId: string; raisedById: string; reason: string; description?: string; evidence?: string }) {
    return this.prisma.dispute.create({ data, include: { mission: true, raisedBy: true } });
  }

  findAll() {
    return this.prisma.dispute.findMany({ include: { mission: true, raisedBy: true }, orderBy: { createdAt: 'desc' } });
  }

  findByMission(missionId: string) {
    return this.prisma.dispute.findMany({ where: { missionId }, include: { raisedBy: true } });
  }

  findByUser(userId: string) {
    return this.prisma.dispute.findMany({ where: { raisedById: userId }, include: { mission: true }, orderBy: { createdAt: 'desc' } });
  }

  async update(id: string, data: { status?: any; decision?: any; adminNotes?: string }) {
    const resolvedAt = data.status === 'resolved' || data.status === 'rejected' || data.status === 'compensated' ? new Date() : undefined;
    const dispute = await this.prisma.dispute.update({
      where: { id },
      data: { ...data, ...(resolvedAt ? { resolvedAt } : {}) },
      include: { mission: true, raisedBy: true },
    });

    // Appliquer la sanction à la partie mise en cause (le prestataire de la mission)
    if (data.decision && data.decision !== 'none') {
      await this.applySanction(dispute.mission, data.decision);
    }

    return dispute;
  }

  /**
   * Applique la sanction décidée par l'admin sur le prestataire de la mission.
   * - temporary_suspension / permanent_deactivation: désactive le compte (isActive=false)
   * - warning: aucune action sur le compte (la décision reste tracée sur le litige)
   */
  private async applySanction(mission: any, decision: string) {
    const targetUserId = mission?.providerId;
    if (!targetUserId) return;
    if (decision === 'temporary_suspension' || decision === 'permanent_deactivation') {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { isActive: false },
      });
    }
  }
}
