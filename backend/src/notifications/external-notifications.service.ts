import { createHash, createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { isSenegalPhone, normalizePhoneE164 } from '../utils/phone.util';

export interface ExternalNotification {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class ExternalNotificationsService {
  private readonly logger = new Logger(ExternalNotificationsService.name);
  private readonly whatsappToken: string | undefined;
  private readonly whatsappPhoneId: string | undefined;

  /** Orange SMS Pro (Alert / HTTP) — prioritaire si configuré */
  private readonly orangeLogin: string | undefined;
  private readonly orangePassword: string | undefined;
  private readonly orangeToken: string | undefined;
  private readonly orangePrivateKey: string | undefined;
  private readonly orangeSender: string;
  private readonly orangeUrl: string;

  private readonly vonageApiKey: string | undefined;
  private readonly vonageApiSecret: string | undefined;
  private readonly vonageFrom: string | undefined;
  private readonly vonageMessagesUrl: string;
  private readonly resendApiKey: string | undefined;
  private readonly resendFrom: string;
  private readonly smtpHost: string | undefined;
  private readonly smtpUser: string | undefined;
  private readonly smtpPass: string | undefined;
  private readonly smtpFrom: string;
  private resendClient: Resend | undefined;
  private mailTransporter: nodemailer.Transporter | undefined;

  constructor(private readonly config: ConfigService) {
    this.whatsappToken = this.config.get<string>('WHATSAPP_TOKEN');
    this.whatsappPhoneId = this.config.get<string>('WHATSAPP_PHONE_ID');

    this.orangeLogin = this.config.get<string>('ORANGE_SMS_LOGIN');
    this.orangePassword = this.config.get<string>('ORANGE_SMS_PASSWORD');
    this.orangeToken = this.config.get<string>('ORANGE_SMS_TOKEN');
    this.orangePrivateKey =
      this.config.get<string>('ORANGE_SMS_PRIVATE_KEY') || this.config.get<string>('ORANGE_SMS_KEY');
    this.orangeSender =
      this.config.get<string>('ORANGE_SMS_SENDER') ||
      this.config.get<string>('ORANGE_SMS_SIGNATURE') ||
      'Bagup';
    this.orangeUrl =
      this.config.get<string>('ORANGE_SMS_URL') || 'https://api.orangesmspro.sn:8443/api';

    this.vonageApiKey = this.config.get<string>('VONAGE_API_KEY');
    this.vonageApiSecret = this.config.get<string>('VONAGE_API_SECRET');
    this.vonageFrom = this.config.get<string>('VONAGE_FROM') || this.config.get<string>('VONAGE_BRAND_NAME');
    this.vonageMessagesUrl =
      this.config.get<string>('VONAGE_MESSAGES_URL') || 'https://api.nexmo.com/v1/messages';

    this.resendApiKey = this.config.get<string>('RESEND_API_KEY');
    this.resendFrom =
      this.config.get<string>('RESEND_FROM') || "Bag'up <no-reply@bagupafrica.com>";

    this.smtpHost = this.config.get<string>('SMTP_HOST');
    this.smtpUser = this.config.get<string>('SMTP_USER');
    this.smtpPass = this.config.get<string>('SMTP_PASS');
    this.smtpFrom = this.config.get<string>('SMTP_FROM') || this.resendFrom;

    if (this.resendApiKey) {
      this.resendClient = new Resend(this.resendApiKey);
      this.logger.log('Resend activé pour les emails');
    } else if (this.isSmtpEnabled()) {
      this.mailTransporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: parseInt(this.config.get<string>('SMTP_PORT') || '587', 10),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: { user: this.smtpUser, pass: this.smtpPass },
      });
    }

    if (this.isOrangeSmsEnabled()) {
      this.logger.log(`Orange SMS Pro activé (sender=${this.orangeSender})`);
    } else if (this.isVonageSmsEnabled()) {
      this.logger.log('Vonage SMS activé');
    } else {
      this.logger.warn('SMS non configuré (Orange SMS Pro ou Vonage)');
    }
  }

  isWhatsAppEnabled(): boolean {
    return !!(this.whatsappToken && this.whatsappPhoneId);
  }

  isSmsEnabled(): boolean {
    return this.isOrangeSmsEnabled() || this.isVonageSmsEnabled();
  }

  private isOrangeSmsEnabled(): boolean {
    return !!(this.orangeToken && this.orangePrivateKey);
  }

  private isVonageSmsEnabled(): boolean {
    return !!(this.vonageApiKey && this.vonageApiSecret && this.vonageFrom);
  }

  isEmailEnabled(): boolean {
    return !!(this.resendApiKey || this.isSmtpEnabled());
  }

  private isSmtpEnabled(): boolean {
    return !!(this.smtpHost && this.smtpUser && this.smtpPass);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.isEmailEnabled()) {
      this.logger.warn('Email non configuré (Resend/SMTP) — envoi ignoré');
      return false;
    }

    if (this.resendClient) {
      try {
        const { error } = await this.resendClient.emails.send({
          from: this.resendFrom,
          to,
          subject,
          html,
        });
        if (error) {
          this.logger.error(`Resend error: ${error.message}`);
          return false;
        }
        this.logger.log(`Email Resend envoyé à ${to}`);
        return true;
      } catch (err) {
        this.logger.error('Resend send failed:', err);
        return false;
      }
    }

    try {
      await this.mailTransporter!.sendMail({ from: this.smtpFrom, to, subject, html });
      this.logger.log(`Email SMTP envoyé à ${to}`);
      return true;
    } catch (err) {
      this.logger.error('SMTP send failed:', err);
      return false;
    }
  }

  async sendWhatsApp(phone: string, message: string): Promise<boolean> {
    if (!this.isWhatsAppEnabled()) {
      this.logger.warn('WhatsApp non configuré — envoi ignoré');
      return false;
    }

    const formattedPhone = normalizePhoneE164(phone);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${this.whatsappPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'text',
            text: { body: message },
          }),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`WhatsApp API error: ${err}`);
        return false;
      }

      this.logger.log(`WhatsApp envoyé à ${formattedPhone}`);
      return true;
    } catch (err) {
      this.logger.error('WhatsApp send failed:', err);
      return false;
    }
  }

  /**
   * Envoie un SMS — Orange SMS Pro pour le Sénégal (+221), Vonage pour l'international.
   */
  async sendSms(phone: string, message: string): Promise<boolean> {
    if (!this.isSmsEnabled()) {
      this.logger.warn('SMS non configuré — envoi ignoré');
      return false;
    }

    const e164 = normalizePhoneE164(phone);
    const senegal = isSenegalPhone(e164);

    if (senegal && this.isOrangeSmsEnabled()) {
      const ok = await this.sendOrangeSms(e164, message);
      if (ok) return true;
      if (this.isVonageSmsEnabled()) {
        this.logger.warn('Orange SMS a échoué — fallback Vonage');
        return this.sendVonageSms(e164, message);
      }
      return false;
    }

    if (this.isVonageSmsEnabled()) {
      return this.sendVonageSms(e164, message);
    }

    if (senegal && this.isOrangeSmsEnabled()) {
      return this.sendOrangeSms(e164, message);
    }

    this.logger.warn(`SMS non envoyé — aucun canal disponible pour ${e164}`);
    return false;
  }

  /**
   * Orange SMS Pro — API Alert / HTTP (port 8443)
   * Docs : Mes applications - WS → Alert SMS
   * chaine = token + subject + signature + recipient + content + timestamp
   * key = HMAC-SHA1(chaine, clé privée)  — usage unique (erreur 115 si réutilisée)
   */
  private async sendOrangeSms(phone: string, message: string): Promise<boolean> {
    const recipient = normalizePhoneE164(phone).replace(/^\+/, '');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = this.orangeToken!;
    const privateKey = this.orangePrivateKey!;
    const signature = this.orangeSender;
    const subject = signature;
    const content = message;

    const chaine = `${token}${subject}${signature}${recipient}${content}${timestamp}`;
    const key = createHmac('sha1', privateKey).update(chaine, 'utf8').digest('hex');

    const params = new URLSearchParams({
      token,
      subject,
      signature,
      recipient,
      content,
      timestamp,
      key,
    });

    try {
      const res = await fetch(`${this.orangeUrl}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const raw = await res.text();
      let parsed: {
        response?: Array<{ status_code?: number; status_text?: string }>;
        status_code?: number;
        status?: number | string;
        message?: string;
      } | null = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // ignore
      }

      const first = parsed?.response?.[0];
      const code = Number(first?.status_code ?? parsed?.status_code ?? parsed?.status ?? res.status);
      if (!res.ok || code !== 200) {
        this.logger.error(
          `Orange SMS Pro error (${code || res.status}): ${first?.status_text || parsed?.message || raw}`,
        );
        return false;
      }

      this.logger.log(`SMS Orange envoyé à ${recipient}`);
      return true;
    } catch (err) {
      this.logger.error('Orange SMS Pro send failed:', err);
      return false;
    }
  }

  private async sendVonageSms(phone: string, message: string): Promise<boolean> {
    const to = normalizePhoneE164(phone).replace(/^\+/, '');
    const auth = Buffer.from(`${this.vonageApiKey}:${this.vonageApiSecret}`).toString('base64');

    try {
      const res = await fetch(this.vonageMessagesUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          channel: 'sms',
          message_type: 'text',
          to,
          from: this.vonageFrom,
          text: message,
        }),
      });

      const raw = await res.text();
      let parsed: { message_uuid?: string; title?: string; detail?: string; type?: string } | null =
        null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // ignore
      }

      if (!res.ok) {
        this.logger.error(
          `Vonage Messages API error (${res.status}): ${parsed?.detail || parsed?.title || raw}`,
        );
        return false;
      }

      this.logger.log(`SMS Vonage envoyé à ${to} (uuid=${parsed?.message_uuid || 'n/a'})`);
      return true;
    } catch (err) {
      this.logger.error('Vonage SMS send failed:', err);
      return false;
    }
  }

  async sendAll(phone: string, message: string): Promise<void> {
    await Promise.allSettled([this.sendWhatsApp(phone, message), this.sendSms(phone, message)]);
  }
}
