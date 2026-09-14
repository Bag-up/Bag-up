import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentMethod } from '@prisma/client';
import {
  InitiateChargeInput,
  InitiateChargeResult,
  ParsedWebhook,
  PaymentProvider,
  ProviderChargeStatus,
} from './payment-provider.interface';

/**
 * Passerelle Bictorys — paiements locaux Afrique de l'Ouest (Wave, Orange Money,
 * carte locale) via un endpoint unique. Doc : https://docs.bictorys.com
 *
 * Tant que les variables d'environnement ne sont pas renseignées, isConfigured()
 * renvoie false et la factory bascule sur le MockProvider.
 */
@Injectable()
export class BictorysProvider implements PaymentProvider {
  readonly name = 'bictorys';
  private readonly logger = new Logger(BictorysProvider.name);

  private readonly apiUrl = process.env.BICTORYS_API_URL || 'https://api.test.bictorys.com';
  private readonly apiKey = process.env.BICTORYS_API_KEY || '';
  private readonly webhookSecret = process.env.BICTORYS_WEBHOOK_SECRET || '';

  /** Mappe l'enum interne vers le payment_type attendu par Bictorys. */
  private static readonly PAYMENT_TYPE: Record<PaymentMethod, string> = {
    [PaymentMethod.orange_money]: 'orange_money',
    [PaymentMethod.wave]: 'wave_money',
    [PaymentMethod.free_money]: 'free_money',
    [PaymentMethod.card]: 'card',
    [PaymentMethod.cash]: 'cash',
  };

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.webhookSecret);
  }

  async initiateCharge(input: InitiateChargeInput): Promise<InitiateChargeResult> {
    const paymentType = BictorysProvider.PAYMENT_TYPE[input.method];
    const query =
      input.method === PaymentMethod.card
        ? 'payment_type=card&payment_category=card'
        : `payment_type=${paymentType}`;
    const url = `${this.apiUrl}/pay/v1/charges?${query}`;

    const body: Record<string, unknown> = {
      amount: Math.round(input.amount),
      currency: input.currency,
      country: input.country || 'SN',
      paymentReference: input.paymentId,
      successRedirectUrl: input.successRedirectUrl || 'https://admin.bagup.app/payment/success',
      ErrorRedirectUrl: input.errorRedirectUrl || 'https://admin.bagup.app/payment/error',
      customerObject: input.customer,
    };
    if (input.otp) body.otp = input.otp;

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'X-Api-Key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data: any = await res.json();
        return {
          provider: this.name,
          providerRef: data.transactionId,
          status: 'processing',
          redirectUrl: data.redirectUrl,
          link: data.link,
          qrCode: data.qrCode,
          message: data.message,
          raw: data,
        };
      }

      const errorText = await res.text();
      // WAF 403 (HTML) → retry avec backoff exponentiel
      if (res.status === 403 && errorText.includes('Forbidden') && attempt < MAX_RETRIES) {
        this.logger.warn(`Bictorys WAF 403, retry ${attempt + 1}/${MAX_RETRIES}`);
        continue;
      }
      throw new Error(`Bictorys charge error (${res.status}): ${errorText}`);
    }
    throw new Error('Bictorys charge: nombre maximal de tentatives atteint');
  }

  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): boolean {
    const signature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];
    const secretKey = headers['x-secret-key'];

    // Méthode 1 : HMAC-SHA256 (recommandée) avec protection anti-rejeu
    if (signature && timestamp) {
      const ts = parseInt(timestamp, 10);
      if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');
      return this.safeEqual(signature, expected);
    }

    // Méthode 2 : clé statique (fallback)
    if (secretKey) {
      return this.safeEqual(secretKey, this.webhookSecret);
    }
    return false;
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const data = JSON.parse(rawBody);
    return {
      eventId: data.id,
      paymentRef: data.paymentReference || data.merchantReference,
      providerRef: data.id,
      status: this.mapStatus(data.status),
      amount: data.amount,
      currency: data.currency,
    };
  }

  private mapStatus(status: string): ProviderChargeStatus {
    switch (status) {
      case 'succeeded':
      case 'authorized':
        return 'success';
      case 'pending':
        return 'pending';
      case 'processing':
        return 'processing';
      default:
        // failed, cancelled, reversed
        return 'failed';
    }
  }

  private safeEqual(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}
