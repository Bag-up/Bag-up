import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalNotificationsService } from './external-notifications.service';
import { staffAccountPendingReviewEmail, notificationEmail } from './email-templates';
import { normalizePhoneE164 } from '../utils/phone.util';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export const HOTLINE_PHONE = '+221 78 958 44 44';
export const HOTLINE_EMAIL = 'contact@bagup-services.com';

/** Rôles notifiés pour les validations de compte (hors manager). */
const ACCOUNT_REVIEW_STAFF_ROLES = ['admin', 'assistant'] as const;

const NOTIFICATION_TYPES = new Set<string>(Object.values(NotificationType));

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly externalNotifs: ExternalNotificationsService,
  ) {}

  private resolveType(data?: Record<string, string>): NotificationType {
    const t = data?.type;
    if (t && NOTIFICATION_TYPES.has(t)) return t as NotificationType;
    if (t === 'mission_accepted') return NotificationType.mission_accepted;
    if (t === 'status_update' || t === 'antigaspi' || t === 'marketplace_order' || t === 'marketplace_payout') {
      return t === 'status_update' ? NotificationType.status_update : NotificationType.general;
    }
    if (t === 'payment_success') return NotificationType.payment_success;
    if (t === 'payment_failed') return NotificationType.payment_failed;
    if (t === 'loyalty') return NotificationType.loyalty;
    if (t === 'new_mission') return NotificationType.general;
    return NotificationType.general;
  }

  async sendToUser(userId: string, notification: PushNotification): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, firstName: true, email: true, phone: true },
    });

    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId,
        type: this.resolveType(notification.data),
        title: notification.title,
        body: notification.body,
        data: notification.data ? JSON.stringify(notification.data) : null,
      },
    });

    if (user.fcmToken) {
      await this.sendToFcm(user.fcmToken, notification);
    }
  }

  async sendToUsers(userIds: string[], notification: PushNotification): Promise<void> {
    if (userIds.length === 0) return;

    const type = this.resolveType(notification.data);
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title: notification.title,
        body: notification.body,
        data: notification.data ? JSON.stringify(notification.data) : null,
      })),
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { fcmToken: true },
    });

    const tokens = users.filter(u => u.fcmToken).map(u => u.fcmToken!);
    if (tokens.length === 0) return;

    await Promise.all(tokens.map(t => this.sendToFcm(t, notification)));
  }

  /** Notifie tous les comptes admin (suivi / filet de sécurité). */
  async sendToAdmins(notification: PushNotification): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    });
    await this.sendToUsers(
      admins.map((a) => a.id),
      notification,
    );
  }

  /** Admin + assistante : in-app + push (si token). */
  async sendToReviewStaff(notification: PushNotification): Promise<void> {
    const staff = await this.prisma.user.findMany({
      where: { role: { in: [...ACCOUNT_REVIEW_STAFF_ROLES] }, isActive: true },
      select: { id: true },
    });
    await this.sendToUsers(
      staff.map((s) => s.id),
      notification,
    );
  }

  /**
   * Nouveau presta / commerçant → alerte admin + assistante
   * (in-app, push, email, SMS) pour valider même hors back-office.
   */
  async notifyStaffAccountPendingReview(applicant: {
    id: string;
    role: 'provider' | 'merchant';
    phone: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<void> {
    const roleFr = applicant.role === 'merchant' ? 'commerçant' : 'prestataire';
    const applicantName = [applicant.firstName, applicant.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || applicant.phone;
    const adminBase =
      process.env.ADMIN_WEB_URL?.replace(/\/$/, '') ||
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ||
      'https://admin.bagup.app';
    const reviewUrl = `${adminBase}/users/${applicant.id}`;
    const title = 'Compte à valider';
    const body = `${applicantName} · ${roleFr} — dossier en attente de validation`;

    const staff = await this.prisma.user.findMany({
      where: { role: { in: [...ACCOUNT_REVIEW_STAFF_ROLES] }, isActive: true },
      select: { id: true, email: true, phone: true, firstName: true },
    });

    if (staff.length === 0) {
      this.logger.warn('Aucun admin/assistante actif pour notifier une inscription');
      return;
    }

    // In-app + push Expo (si token mobile)
    await this.sendToUsers(
      staff.map((s) => s.id),
      {
        title,
        body,
        data: {
          type: 'account_pending_review',
          userId: applicant.id,
          role: applicant.role,
        },
      },
    );

    const sms = `Bag'up — Nouveau compte ${roleFr} à valider : ${applicantName} (${applicant.phone}). ${reviewUrl}`;

    // Email + SMS : fiables hors back-office
    await Promise.all(
      staff.map(async (member) => {
        if (member.email?.trim()) {
          const mail = staffAccountPendingReviewEmail({
            staffFirstName: member.firstName,
            applicantName,
            role: applicant.role,
            phone: applicant.phone,
            email: applicant.email,
            reviewUrl,
          });
          await this.sendEmail(member.email.trim(), mail.subject, mail.html);
        }
        if (member.phone) {
          try {
            await this.externalNotifs.sendSms(normalizePhoneE164(member.phone), sms);
          } catch (err: any) {
            this.logger.warn(`SMS staff validation failed → ${member.id}: ${err?.message || err}`);
          }
        }
      }),
    );
  }

  private async sendToFcm(token: string, notification: PushNotification): Promise<void> {
    // Les tokens générés par l'app mobile sont des tokens Expo Push
    // (ExponentPushToken[...]). On les délivre via l'API Expo, gratuite et
    // sans configuration Firebase. Les autres tokens sont simplement loggés.
    if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
      await this.sendExpoPush(token, notification);
      return;
    }
    this.logger.log(`[PUSH] → ${token}: ${notification.title} — ${notification.body}`);
  }

  private async sendExpoPush(token: string, notification: PushNotification): Promise<void> {
    try {
      const isRide = notification.data?.type === 'new_ride' || !!notification.data?.rideId;
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: token,
          title: notification.title,
          body: notification.body,
          data: notification.data ?? {},
          sound: 'default',
          priority: 'high',
          channelId: isRide ? 'rides' : 'default',
          _contentAvailable: true,
        }),
      });
      const raw = await res.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }
      if (!res.ok) {
        this.logger.error(`Expo push error: ${raw || res.status}`);
        return;
      }
      const tickets = Array.isArray(payload?.data)
        ? payload.data
        : payload?.data
          ? [payload.data]
          : [];
      for (const ticket of tickets) {
        if (ticket?.status === 'error') {
          this.logger.error(
            `Expo push ticket error (${token.slice(0, 24)}…): ${ticket.message || ticket.details?.error || 'unknown'}`,
          );
        }
      }
      this.logger.log(`[EXPO PUSH] → ${token.slice(0, 24)}…: ${notification.title}`);
    } catch (err: any) {
      this.logger.error(`Expo push failed: ${err.message}`);
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      const ok = await this.externalNotifs.sendEmail(to, subject, html);
      if (!ok) this.logger.warn(`[EMAIL] échec envoi → ${to}: ${subject}`);
    } catch (err: any) {
      this.logger.error(`Email send failed: ${err.message}`);
    }
  }

  async sendSms(to: string, message: string): Promise<void> {
    // Ne pas router vers Orange ici : SMS réservés (OTP / code remise / acceptée / livrée).
    this.logger.log(`[SMS skipped multi-channel] → ${to}: ${message}`);
  }

  async notifyUserMultiChannel(userId: string, notification: PushNotification): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, email: true, phone: true, firstName: true },
    });

    if (!user) return;

    if (user.fcmToken) {
      await this.sendToFcm(user.fcmToken, notification);
    }
    if (user.email) {
      const mail = notificationEmail({
        firstName: user.firstName,
        title: notification.title,
        message: notification.body,
      });
      await this.sendEmail(user.email, mail.subject, mail.html);
    }
  }

  getHotline() {
    return { phone: HOTLINE_PHONE, email: HOTLINE_EMAIL };
  }

  async registerFcmToken(userId: string, token: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
    });
    this.logger.log(`FCM token registered for user ${userId}`);
  }

  notifyMissionAccepted(clientId: string, providerName: string) {
    return this.sendToUser(clientId, {
      title: 'Mission acceptée',
      body: `${providerName} a accepté votre mission`,
      data: { type: 'mission_accepted' },
    });
  }

  notifyStatusUpdate(clientId: string, status: string) {
    const labels: Record<string, string> = {
      picked_up: 'Votre colis a été récupéré',
      in_progress: 'Votre livraison est en cours',
      delivered: 'Votre colis a été livré',
    };
    return this.sendToUser(clientId, {
      title: 'Mise à jour mission',
      body: labels[status] || `Statut: ${status}`,
      data: { type: 'status_update', status },
    });
  }

  notifyNewMessage(userId: string, senderName: string, conversationId?: string) {
    return this.sendToUser(userId, {
      title: senderName,
      body: 'Nouveau message',
      data: { type: 'new_message', ...(conversationId ? { conversationId } : {}) },
    });
  }

  notifyNewMission(providerIds: string[], serviceType: string) {
    return this.sendToUsers(providerIds, {
      title: 'Nouvelle mission',
      body: `Mission ${serviceType} disponible`,
      data: { type: 'new_mission' },
    });
  }

  notifySubscriptionExpiring(userId: string, daysLeft: number) {
    return this.sendToUser(userId, {
      title: 'Abonnement',
      body: `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      data: { type: 'subscription_expiring' },
    });
  }

  async getMyNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return { updated: result.count > 0, count: result.count };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count > 0, count: result.count };
  }
}
