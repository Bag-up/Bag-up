import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  InitiateChargeInput,
  InitiateChargeResult,
  ParsedWebhook,
  PaymentProvider,
  ProviderChargeStatus,
} from './payment-provider.interface';

/**
 * Passerelle Stripe — paiements internationaux par carte (diaspora).
 * Utilise l'API REST Stripe (Checkout Session) via fetch, sans dépendance SDK,
 * et valide les webhooks avec le schéma de signature natif de Stripe.
 *
 * Devises à zéro décimale (XOF) : le montant est passé tel quel ; pour les
 * devises à 2 décimales (EUR, USD), Stripe attend des centimes.
 */
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);

  private readonly apiUrl = 'https://api.stripe.com/v1';
  private readonly secretKey = process.env.STRIPE_SECRET_KEY || '';
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  // Devises sans sous-unité : le montant n'est pas multiplié par 100.
  private static readonly ZERO_DECIMAL = new Set(['XOF', 'XAF', 'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'VND', 'VUV', 'XPF']);

  isConfigured(): boolean {
    return Boolean(this.secretKey && this.webhookSecret);
  }

  async initiateCharge(input: InitiateChargeInput): Promise<InitiateChargeResult> {
    const currency = input.currency.toUpperCase();
    const unitAmount = StripeProvider.ZERO_DECIMAL.has(currency)
      ? Math.round(input.amount)
      : Math.round(input.amount * 100);

    const params: Record<string, string> = {
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(unitAmount),
      "line_items[0][price_data][product_data][name]": "Bag'up - paiement de mission",
      success_url: input.successRedirectUrl || 'https://admin.bagup.app/payment/success',
      cancel_url: input.errorRedirectUrl || 'https://admin.bagup.app/payment/error',
      client_reference_id: input.paymentId,
      'metadata[paymentId]': input.paymentId,
    };
    if (input.customer?.email) params.customer_email = input.customer.email;

    const res = await fetch(`${this.apiUrl}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Stripe checkout error (${res.status}): ${errorText}`);
    }

    const data: any = await res.json();
    return {
      provider: this.name,
      providerRef: data.payment_intent || data.id,
      status: 'processing',
      redirectUrl: data.url,
      link: data.url,
      raw: data,
    };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): boolean {
    const header = headers['stripe-signature'];
    if (!header) return false;

    // Format Stripe : "t=timestamp,v1=signature"
    const parts = Object.fromEntries(
      header.split(',').map((kv) => {
        const [k, v] = kv.split('=');
        return [k.trim(), v];
      }),
    );
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    // Protection anti-rejeu : 5 minutes
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false;

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const event = JSON.parse(rawBody);
    const obj = event?.data?.object ?? {};
    return {
      eventId: event.id,
      paymentRef: obj.client_reference_id || obj.metadata?.paymentId,
      providerRef: obj.payment_intent || obj.id,
      status: this.mapStatus(event.type),
      amount: obj.amount_total ?? obj.amount,
      currency: obj.currency?.toUpperCase(),
    };
  }

  private mapStatus(eventType: string): ProviderChargeStatus {
    switch (eventType) {
      case 'checkout.session.completed':
      case 'payment_intent.succeeded':
        return 'success';
      case 'checkout.session.expired':
      case 'payment_intent.payment_failed':
      case 'charge.failed':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
