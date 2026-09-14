import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole, User } from '@prisma/client';
import { UsersService, roleAlreadyExistsMessage, roleLabel } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalNotificationsService } from '../notifications/external-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { DiscoverRolesDto } from '../dto/discover-roles.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../dto/reset-password.dto';
import {
  passwordResetEmail,
  phoneVerificationEmail,
  welcomeClientEmail,
  accountPendingReviewEmail,
} from '../notifications/email-templates';
import { isSenegalPhone, normalizePhoneE164, requiresPhoneVerification } from '../utils/phone.util';

type OtpChannel = 'sms' | 'email';

function maskEmail(email: string): string {
  const [local, domain] = email.trim().split('@');
  if (!domain || !local) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  const e164 = normalizePhoneE164(phone);
  if (e164.length < 6) return '***';
  return `${e164.slice(0, 4)}•••${e164.slice(-2)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly externalNotifs: ExternalNotificationsService,
    private readonly notifications: NotificationsService,
  ) {}

  async login(dto: LoginDto) {
    const password = (dto.password || '').trim();
    let candidates: User[] = [];
    if (dto.email) {
      candidates = await this.prisma.user.findMany({ where: { email: dto.email.trim() } });
    } else if (dto.phone) {
      candidates = await this.users.findAllByPhone(dto.phone.trim());
    }

    const matching: User[] = [];
    for (const candidate of candidates) {
      const valid = await bcrypt.compare(password, candidate.password);
      if (valid) matching.push(candidate);
    }
    if (!matching.length) {
      if (!candidates.length) {
        throw new UnauthorizedException(
          dto.email ? 'Aucun compte avec cet email' : 'Aucun compte avec ce numéro',
        );
      }
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    const user = this.pickLoginUser(matching, dto.role);
    if (!user) {
      const available = [...new Set(matching.map((u) => roleLabel(u.role)))].join(', ');
      throw new UnauthorizedException(
        dto.role
          ? `Aucun compte ${roleLabel(dto.role)} pour ce numéro. Comptes existants : ${available}.`
          : matching.length > 1
            ? `Plusieurs comptes sur ce numéro. Choisissez votre espace : ${available}.`
            : 'Identifiants invalides',
      );
    }
    return this.signToken(user);
  }

  private pickLoginUser<T extends { role: UserRole }>(matching: T[], requestedRole?: UserRole): T | undefined {
    if (requestedRole) {
      return matching.find((u) => u.role === requestedRole);
    }
    if (matching.length === 1) return matching[0];
    if (matching.length > 1) {
      const priority: UserRole[] = ['client', 'provider', 'merchant', 'admin', 'manager', 'assistant'];
      for (const r of priority) {
        const found = matching.find((u) => u.role === r);
        if (found) return found;
      }
      return matching[0];
    }
    return undefined;
  }

  /** Rôles disponibles pour un identifiant (sans mot de passe) — choix d'espace à la connexion. */
  async discoverRoles(dto: DiscoverRolesDto): Promise<{ roles: UserRole[] }> {
    const appRoles: UserRole[] = ['client', 'provider', 'merchant'];
    if (dto.email?.trim()) {
      const users = await this.prisma.user.findMany({
        where: { email: dto.email.trim() },
        select: { role: true },
      });
      return {
        roles: users.map((u) => u.role).filter((r) => appRoles.includes(r)),
      };
    }
    if (dto.phone?.trim()) {
      const users = await this.users.findAllByPhone(dto.phone.trim());
      return {
        roles: users.map((u) => u.role).filter((r) => appRoles.includes(r)),
      };
    }
    throw new BadRequestException('Indiquez un numéro de téléphone ou un email');
  }

  async register(dto: RegisterDto) {
    const existing = await this.users.findByPhoneAndRole(dto.phone, dto.role);
    if (existing) {
      throw new ConflictException(roleAlreadyExistsMessage(dto.role));
    }
    // Diaspora : pas de SMS — email obligatoire pour la vérif compte
    if (!isSenegalPhone(dto.phone)) {
      const email = dto.email?.trim();
      if (!email || !isValidEmail(email)) {
        throw new BadRequestException(
          'Email obligatoire pour les numéros hors Sénégal (vérification par email, sans SMS)',
        );
      }
    }
    const user = await this.users.create(dto);
    let otp: {
      message: string;
      channel?: OtpChannel;
      destination?: string;
      sent: boolean;
    } | null = null;
    try {
      const sent = await this.sendOtp(user.phone, user.id, user.email || undefined);
      otp = { ...sent, sent: true };
    } catch (err: any) {
      this.logger.warn(`OTP après inscription non envoyé: ${err?.message || err}`);
      otp = { message: 'Code non envoyé', sent: false };
    }
    // Mails / SMS staff après l’OTP, pour ne pas bloquer le code de vérification
    void this.sendRegistrationNotices(user).catch((err) =>
      this.logger.warn(`Registration notice failed: ${err?.message || err}`),
    );
    return { ...this.signToken(user), otp };
  }

  /** Client = bienvenue ; presta/commerçant = dossier en attente + alerte staff. */
  private async sendRegistrationNotices(user: {
    id: string;
    role: UserRole;
    email: string | null;
    phone: string;
    firstName: string | null;
    lastName?: string | null;
  }) {
    if (user.role === 'client') {
      if (!user.email?.trim()) return;
      const mail = welcomeClientEmail({ firstName: user.firstName });
      await this.externalNotifs.sendEmail(user.email.trim(), mail.subject, mail.html);
      return;
    }

    if (user.role !== 'provider' && user.role !== 'merchant') return;

    const mail = accountPendingReviewEmail({
      firstName: user.firstName,
      role: user.role,
    });
    if (user.email?.trim()) {
      await this.externalNotifs.sendEmail(user.email.trim(), mail.subject, mail.html);
    } else {
      // SN sans email : petit SMS pour confirmer la réception du dossier
      const roleFr = user.role === 'merchant' ? 'commerçant' : 'prestataire';
      await this.externalNotifs.sendSms(
        normalizePhoneE164(user.phone),
        `Bag'up — Votre inscription ${roleFr} est bien reçue. Compte en attente de validation. Vous serez notifié une fois activé.`,
      );
    }

    await this.notifications.notifyStaffAccountPendingReview({
      id: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName ?? null,
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email?.trim().toLowerCase() || '';
    const phoneRaw = dto.phone?.trim() || '';
    if (!email && !phoneRaw) {
      throw new BadRequestException(
        'Indiquez votre numéro de téléphone ou votre email pour récupérer votre compte',
      );
    }

    let accounts: User[] = [];
    if (phoneRaw) {
      accounts = await this.users.findAllByPhone(phoneRaw);
      if (dto.role) {
        accounts = accounts.filter((a) => a.role === dto.role);
      }
    } else {
      accounts = await this.prisma.user.findMany({
        where: {
          email: { equals: email, mode: 'insensitive' },
          ...(dto.role ? { role: dto.role } : {}),
        },
      });
    }

    if (!accounts.length) {
      if (phoneRaw) {
        throw new NotFoundException(
          'Aucun compte avec ce numéro. Vérifiez l’indicatif et le numéro.',
        );
      }
      throw new NotFoundException(
        'Aucun compte lié à cet email. Si vous n’avez pas renseigné d’email à l’inscription, utilisez votre numéro de téléphone.',
      );
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 3600000);
    await this.prisma.user.updateMany({
      where: { id: { in: accounts.map((a) => a.id) } },
      data: { resetToken, resetExpiry: expires },
    });

    const primary = accounts[0];
    const targetPhone = normalizePhoneE164(primary.phone);
    const targetEmail = (primary.email || email || '').trim().toLowerCase();
    const smsBody = `Bag'up — Code de réinitialisation : ${resetToken}. Valable 1 heure.`;

    let sent = false;
    let channel: 'sms' | 'email' = 'sms';

    // Priorité : SMS (surtout SN) — la plupart des comptes n’ont pas d’email
    const preferSms = isSenegalPhone(targetPhone) || !targetEmail || !isValidEmail(targetEmail);
    if (preferSms && targetPhone) {
      channel = 'sms';
      sent = await this.externalNotifs.sendSms(targetPhone, smsBody);
    }
    if (!sent && targetEmail && isValidEmail(targetEmail)) {
      channel = 'email';
      const mail = passwordResetEmail({ firstName: primary.firstName, code: resetToken });
      sent = await this.externalNotifs.sendEmail(targetEmail, mail.subject, mail.html);
    }
    if (!sent && targetPhone) {
      channel = 'sms';
      sent = await this.externalNotifs.sendSms(targetPhone, smsBody);
    }

    if (!sent) {
      return {
        message: 'Code de réinitialisation (mode dev)',
        devToken: resetToken,
        channel,
      };
    }

    return {
      message:
        channel === 'sms'
          ? `Code envoyé par SMS au ${maskPhone(targetPhone)}`
          : `Code envoyé par email à ${maskEmail(targetEmail)}`,
      channel,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = dto.token.trim();
    const accounts = await this.prisma.user.findMany({ where: { resetToken: token } });
    if (!accounts.length) throw new UnauthorizedException('Code invalide');
    if (accounts.some((u) => !u.resetExpiry || u.resetExpiry < new Date())) {
      throw new UnauthorizedException('Code expiré. Demandez un nouveau code.');
    }
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.updateMany({
      where: { resetToken: token },
      data: { password: hashed, resetToken: null, resetExpiry: null },
    });
    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  private signToken(user: {
    id: string;
    phone: string;
    role: string;
    phoneVerified: boolean;
    isVerified: boolean;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }) {
    const payload = { sub: user.id, phone: user.phone, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        role: user.role,
        phoneVerified: user.phoneVerified,
        isVerified: user.isVerified,
      },
    };
  }

  private async resolveOtpUser(phone: string, userId?: string) {
    if (userId) {
      const user = await this.users.findById(userId);
      if (!user) throw new NotFoundException('Aucun compte avec ce numéro');
      return user;
    }
    const accounts = await this.users.findAllByPhone(phone);
    if (!accounts.length) throw new NotFoundException('Aucun compte avec ce numéro');
    const unverified = accounts
      .filter((u) => !u.phoneVerified)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return unverified[0] ?? accounts[0];
  }

  async sendOtp(phone: string, userId?: string, email?: string) {
    let user = await this.resolveOtpUser(phone, userId);
    if (user.phoneVerified) throw new BadRequestException('Numéro déjà vérifié');

    const targetPhone = normalizePhoneE164(user.phone);
    if (!requiresPhoneVerification(targetPhone)) {
      throw new BadRequestException('Numéro de téléphone invalide ou indicatif non pris en charge');
    }

    const channel: OtpChannel = isSenegalPhone(targetPhone) ? 'sms' : 'email';

    // Diaspora : rattacher / exiger un email avant envoi
    if (channel === 'email') {
      const incoming = email?.trim().toLowerCase();
      if (incoming) {
        if (!isValidEmail(incoming)) {
          throw new BadRequestException('Adresse email invalide');
        }
        if (incoming !== (user.email || '').trim().toLowerCase()) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { email: incoming },
          });
        }
      }
      if (!user.email?.trim() || !isValidEmail(user.email)) {
        throw new BadRequestException(
          'Email requis pour vérifier un numéro hors Sénégal. Ajoutez votre email.',
        );
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: code, otpExpiry: expires, otpAttempts: 0 },
    });

    const delivered = await this.deliverOtpCode(user, code, channel);
    return this.otpSendResponse(channel, targetPhone, user.email, code, delivered);
  }

  async verifyOtp(phone: string, code: string, userId?: string) {
    const user = await this.resolveOtpUser(phone, userId);
    if (user.phoneVerified) throw new BadRequestException('Numéro déjà vérifié');

    if (!user.otpCode) {
      throw new BadRequestException('Aucun code en attente. Demandez un nouveau code.');
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      throw new BadRequestException('Code expiré. Demandez un nouveau code.');
    }

    if (user.otpCode !== code) {
      const newAttempts = user.otpAttempts + 1;
      if (newAttempts >= 3) {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newExpires = new Date(Date.now() + 5 * 60 * 1000);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { otpCode: newCode, otpExpiry: newExpires, otpAttempts: 0 },
        });
        const channel: OtpChannel = isSenegalPhone(user.phone) ? 'sms' : 'email';
        const delivered = await this.deliverOtpCode(user, newCode, channel);
        const channelLabel = channel === 'email' ? 'email' : 'SMS';
        if (!delivered) {
          throw new BadRequestException({
            message: `3 essais échoués. Nouveau code généré (mode dev).`,
            devCode: newCode,
            channel,
          });
        }
        throw new BadRequestException(`3 essais échoués. Nouveau code envoyé par ${channelLabel}.`);
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: newAttempts },
      });
      throw new UnauthorizedException(`Code incorrect (${newAttempts}/3 essais)`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true, otpCode: null, otpExpiry: null, otpAttempts: 0 },
    });

    // Même numéro, autres rôles (client / presta / commerçant)
    await this.prisma.user.updateMany({
      where: this.users.phoneVariantsWhere(user.phone),
      data: { phoneVerified: true, otpCode: null, otpExpiry: null, otpAttempts: 0 },
    });

    return { message: 'Compte vérifié avec succès' };
  }

  async skipOtp(phone: string, userId?: string) {
    const allowSkip =
      process.env.OTP_SHOW_DEV_CODE === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.OTP_SHOW_DEV_CODE !== 'false');
    if (!allowSkip) {
      throw new BadRequestException('La vérification du compte est obligatoire');
    }
    const user = await this.resolveOtpUser(phone, userId);
    if (user.phoneVerified) return { message: 'Compte déjà vérifié' };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true, otpCode: null, otpExpiry: null, otpAttempts: 0 },
    });
    return { message: 'Vérification ignorée (mode dev)' };
  }

  private async deliverOtpCode(
    user: { id: string; phone: string; email: string | null; firstName: string | null },
    code: string,
    channel: OtpChannel,
  ): Promise<boolean> {
    if (channel === 'email') {
      const to = user.email?.trim();
      if (!to) return false;
      const mail = phoneVerificationEmail({ firstName: user.firstName, code });
      return this.externalNotifs.sendEmail(to, mail.subject, mail.html);
    }
    const message = `Bag'up - Votre code de vérification est: ${code}. Valable 5 minutes.`;
    return this.externalNotifs.sendSms(normalizePhoneE164(user.phone), message);
  }

  private otpSendResponse(
    channel: OtpChannel,
    phone: string,
    email: string | null | undefined,
    code: string,
    delivered: boolean,
  ) {
    const destination =
      channel === 'email' ? maskEmail(email || '') : maskPhone(phone);
    const showDevCode =
      !delivered ||
      process.env.OTP_SHOW_DEV_CODE === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.OTP_SHOW_DEV_CODE !== 'false');

    const baseMessage =
      channel === 'email'
        ? delivered
          ? 'Code envoyé par email'
          : 'Code de vérification (mode dev)'
        : delivered
          ? 'Code SMS envoyé'
          : 'Code de vérification (mode dev)';

    if (showDevCode) {
      return {
        message: delivered ? `${baseMessage} (mode dev)` : baseMessage,
        channel,
        destination,
        devCode: code,
      };
    }

    return { message: baseMessage, channel, destination };
  }
}
